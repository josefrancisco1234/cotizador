import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * GET /api/quotations/[id]/preview?recipientId=xxx
 * Returns rendered HTML email for a specific recipient (or first email one if not specified).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const recipientId = request.nextUrl.searchParams.get("recipientId");

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

  // Load recipient(s)
  let recipientQuery = supabase
    .from("quotation_recipients")
    .select(`
      id, channel,
      client:clients!inner(business_name, client_code),
      contact:client_contacts!inner(contact_name, salutation, channel_value)
    `)
    .eq("quotation_id", id)
    .eq("tenant_id", TENANT_ID)
    .eq("channel", "email");

  if (recipientId) {
    recipientQuery = recipientQuery.eq("id", recipientId);
  } else {
    recipientQuery = recipientQuery.limit(1);
  }

  const { data: recipients } = await recipientQuery;

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "No email recipients found" }, { status: 404 });
  }

  type Recipient = {
    id: string;
    client: { business_name: string; client_code: string };
    contact: { contact_name: string | null; salutation: string | null; channel_value: string };
  };

  const recipient = recipients[0] as unknown as Recipient;
  const qData = quotation as unknown as { payment_terms: string | null; items: QuotationEmailItem[] };

  if (!qData.items || qData.items.length === 0) {
    return NextResponse.json({ error: "No items in quotation" }, { status: 404 });
  }

  const html = buildQuotationEmailHtml({
    salutation: recipient.contact.salutation,
    contactName: recipient.contact.contact_name,
    items: qData.items,
    paymentTerms: qData.payment_terms || DEFAULT_PAYMENT_TERMS,
    senderName: SENDER_NAME,
    companyName: COMPANY_NAME,
  });

  const subject = buildQuotationEmailSubject(qData.items, COMPANY_NAME);

  return NextResponse.json({
    recipientId: recipient.id,
    to: recipient.contact.channel_value,
    contactName: recipient.contact.contact_name,
    clientName: recipient.client.business_name,
    subject,
    html,
  });
}
