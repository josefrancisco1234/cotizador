import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveDraftViaGmail } from "@/lib/gmail/send-email";
import {
  buildQuotationEmailHtml,
  buildQuotationEmailSubject,
  type QuotationEmailItem,
} from "@/lib/dispatch/quotation-email-builder";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;
const COMPANY_NAME = "Petroquimica";
const SENDER_NAME = "Maricarmen Fernandez";
const DEFAULT_PAYMENT_TERMS = "CAD / 30 dias";

/**
 * POST /api/quotations/[id]/save-drafts
 * Creates Gmail drafts for all email recipients (does NOT send).
 * Groups by unique email address: one draft per recipient with all grades.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Load quotation + items
  const { data: quotation, error: qErr } = await supabase
    .from("quotations")
    .select(`
      id, payment_terms,
      items:quotation_items(
        price_usd,
        grade:product_grades!inner(
          grade_code, uso, brand, manufacturer, attributes, melt_index_label,
          family:material_families!inner(display_name)
        )
      )
    `)
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (qErr || !quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  // Load all email recipients
  const { data: recipients } = await supabase
    .from("quotation_recipients")
    .select(`
      id, channel,
      client:clients!inner(business_name, client_code),
      contact:client_contacts!inner(contact_name, salutation, channel_value)
    `)
    .eq("quotation_id", id)
    .eq("tenant_id", TENANT_ID)
    .eq("channel", "email");

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "No email recipients found" }, { status: 400 });
  }

  type Recipient = {
    id: string;
    client: { business_name: string; client_code: string };
    contact: { contact_name: string | null; salutation: string | null; channel_value: string };
  };

  const qData = quotation as unknown as { payment_terms: string | null; items: QuotationEmailItem[] };
  const subject = buildQuotationEmailSubject(qData.items, COMPANY_NAME);

  // Deduplicate by email — one draft per unique address
  const byEmail = new Map<string, Recipient>();
  for (const r of recipients as unknown as Recipient[]) {
    const email = r.contact.channel_value.toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, r);
  }

  const results: Array<{ email: string; client: string; draftId?: string; error?: string }> = [];

  for (const [email, recipient] of byEmail) {
    const html = buildQuotationEmailHtml({
      salutation: recipient.contact.salutation,
      contactName: recipient.contact.contact_name,
      items: qData.items,
      paymentTerms: qData.payment_terms || DEFAULT_PAYMENT_TERMS,
      senderName: SENDER_NAME,
      companyName: COMPANY_NAME,
    });

    const result = await saveDraftViaGmail({
      to: email,
      subject,
      htmlBody: html,
      fromName: SENDER_NAME,
    });

    results.push({
      email,
      client: recipient.client.business_name,
      draftId: result.draftId,
      error: result.error,
    });
  }

  const saved = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  return NextResponse.json({ saved, failed, results });
}
