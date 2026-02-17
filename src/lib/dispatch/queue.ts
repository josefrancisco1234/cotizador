/**
 * Dispatch Queue Manager
 *
 * Processes pending quotation recipients, sending WhatsApp and email messages.
 * Uses database as queue (no external queue service needed for MVP).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate, buildWhatsAppQuotationParams } from "./whatsapp";
import { sendQuotationEmail } from "./email";
import { buildWhatsAppMessage, buildEmailHtml, buildEmailSubject } from "./templates";
import type { QuotationData } from "./templates";

interface DispatchConfig {
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  resendApiKey: string;
  resendFromEmail: string;
  whatsappTemplateName: string;
  senderName: string;
  companyName: string;
  defaultPaymentTerms: string;
  defaultShipmentEstimate: string;
  batchSize: number;
  delayBetweenSendsMs: number;
}

interface DispatchResult {
  processed: number;
  sent: number;
  failed: number;
  errors: { recipientId: string; error: string }[];
}

export async function processDispatchQueue(
  supabase: SupabaseClient,
  tenantId: string,
  config: DispatchConfig,
): Promise<DispatchResult> {
  const result: DispatchResult = { processed: 0, sent: 0, failed: 0, errors: [] };

  // Fetch pending recipients with all related data
  const { data: recipients, error } = await supabase
    .from("quotation_recipients")
    .select(`
      id, channel, dispatch_status, retry_count,
      client:clients!inner(id, client_code, business_name),
      contact:client_contacts!inner(id, contact_name, salutation, channel_value),
      quotation:quotations!inner(
        id, payment_terms, shipment_terms,
        items:quotation_items(
          price_usd,
          grade:product_grades!inner(
            grade_code, uso, brand, manufacturer, attributes, melt_index_label,
            family:material_families!inner(display_name)
          )
        )
      )
    `)
    .eq("tenant_id", tenantId)
    .in("dispatch_status", ["pending", "queued"])
    .order("created_at")
    .limit(config.batchSize);

  if (error) {
    console.error("Queue fetch error:", error.message);
    return result;
  }

  if (!recipients || recipients.length === 0) {
    return result;
  }

  for (const recipient of recipients) {
    result.processed++;

    // Extract data for template
    const client = recipient.client as unknown as { id: string; client_code: string; business_name: string };
    const contact = recipient.contact as unknown as { id: string; contact_name: string; salutation: string; channel_value: string };
    const quotation = recipient.quotation as unknown as {
      id: string;
      payment_terms: string;
      shipment_terms: string;
      items: Array<{
        price_usd: number;
        grade: {
          grade_code: string;
          uso: string;
          brand: string;
          manufacturer: string;
          attributes: string;
          melt_index_label: string;
          family: { display_name: string };
        };
      }>;
    };

    // Use first item for now (future: multi-item quotations)
    const item = quotation.items?.[0];
    if (!item) {
      await updateStatus(supabase, recipient.id, "skipped", "No quotation items found");
      continue;
    }

    const quotationData: QuotationData = {
      salutation: contact.salutation || "Estimado(a)",
      contactName: contact.contact_name || "Cliente",
      familyDisplayName: item.grade.family.display_name,
      uso: item.grade.uso || "General",
      gradeCode: item.grade.grade_code,
      brand: item.grade.brand || "",
      manufacturer: item.grade.manufacturer || "",
      attributes: item.grade.attributes || "",
      meltIndexLabel: item.grade.melt_index_label || "",
      priceUsd: item.price_usd,
      incoterm: "CFR",
      port: "CALLAO",
      paymentTerms: quotation.payment_terms || config.defaultPaymentTerms,
      shipmentEstimate: quotation.shipment_terms || config.defaultShipmentEstimate,
      senderName: config.senderName,
      companyName: config.companyName,
    };

    try {
      if (recipient.channel === "whatsapp") {
        const params = buildWhatsAppQuotationParams({
          contactName: quotationData.contactName,
          familyDisplayName: quotationData.familyDisplayName,
          uso: quotationData.uso,
          gradeCode: quotationData.gradeCode,
          attributes: quotationData.attributes,
          priceUsd: quotationData.priceUsd,
          incoterm: quotationData.incoterm,
          port: quotationData.port,
          paymentTerms: quotationData.paymentTerms,
          shipmentEstimate: quotationData.shipmentEstimate,
        });

        const sendResult = await sendWhatsAppTemplate(
          {
            phoneNumberId: config.whatsappPhoneNumberId,
            accessToken: config.whatsappAccessToken,
          },
          contact.channel_value,
          config.whatsappTemplateName,
          params,
        );

        if (sendResult.success) {
          await updateStatus(supabase, recipient.id, "sent", null, sendResult.messageId);
          // Save message snapshot
          await supabase
            .from("quotation_recipients")
            .update({ message_snapshot: { type: "whatsapp", message: buildWhatsAppMessage(quotationData) } })
            .eq("id", recipient.id);
          result.sent++;
        } else {
          await handleFailure(supabase, recipient.id, recipient.retry_count, sendResult.error || "WhatsApp send failed");
          result.failed++;
          result.errors.push({ recipientId: recipient.id, error: sendResult.error || "" });
        }
      } else {
        // Email
        const html = buildEmailHtml(quotationData);
        const subject = buildEmailSubject({
          familyDisplayName: quotationData.familyDisplayName,
          gradeCode: quotationData.gradeCode,
          companyName: quotationData.companyName,
        });

        const sendResult = await sendQuotationEmail(
          config.resendApiKey,
          config.resendFromEmail,
          contact.channel_value,
          subject,
          html,
        );

        if (sendResult.success) {
          await updateStatus(supabase, recipient.id, "sent", null, sendResult.emailId);
          await supabase
            .from("quotation_recipients")
            .update({ message_snapshot: { type: "email", subject, html } })
            .eq("id", recipient.id);
          result.sent++;
        } else {
          await handleFailure(supabase, recipient.id, recipient.retry_count, sendResult.error || "Email send failed");
          result.failed++;
          result.errors.push({ recipientId: recipient.id, error: sendResult.error || "" });
        }
      }

      // Rate limiting delay
      if (config.delayBetweenSendsMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, config.delayBetweenSendsMs));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await handleFailure(supabase, recipient.id, recipient.retry_count, errMsg);
      result.failed++;
      result.errors.push({ recipientId: recipient.id, error: errMsg });
    }
  }

  return result;
}

async function updateStatus(
  supabase: SupabaseClient,
  recipientId: string,
  status: string,
  errorMessage?: string | null,
  externalMessageId?: string,
) {
  await supabase
    .from("quotation_recipients")
    .update({
      dispatch_status: status,
      dispatched_at: status === "sent" ? new Date().toISOString() : undefined,
      external_message_id: externalMessageId || undefined,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipientId);
}

async function handleFailure(
  supabase: SupabaseClient,
  recipientId: string,
  currentRetryCount: number,
  errorMessage: string,
) {
  const maxRetries = 3;
  const newRetryCount = currentRetryCount + 1;

  if (newRetryCount >= maxRetries) {
    await supabase
      .from("quotation_recipients")
      .update({
        dispatch_status: "failed",
        retry_count: newRetryCount,
        error_message: errorMessage,
        next_retry_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recipientId);
  } else {
    // Exponential backoff: 2^n minutes
    const delayMs = Math.pow(2, newRetryCount) * 60 * 1000;
    const nextRetry = new Date(Date.now() + delayMs).toISOString();

    await supabase
      .from("quotation_recipients")
      .update({
        dispatch_status: "pending",
        retry_count: newRetryCount,
        error_message: errorMessage,
        next_retry_at: nextRetry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recipientId);
  }
}
