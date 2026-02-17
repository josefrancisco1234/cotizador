import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDispatchQueue } from "@/lib/dispatch/queue";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/quotations/[id]/dispatch - Trigger dispatch for a quotation
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: quotationId } = await params;
  const supabase = createAdminClient();

  // Verify quotation is approved
  const { data: quotation, error: qErr } = await supabase
    .from("quotations")
    .select("id, status")
    .eq("id", quotationId)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (qErr || !quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  if (quotation.status !== "approved" && quotation.status !== "sending") {
    return NextResponse.json(
      { error: `Quotation must be approved before dispatch (current: ${quotation.status})` },
      { status: 400 },
    );
  }

  // Update status to sending
  await supabase
    .from("quotations")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", quotationId);

  // Process the queue
  const result = await processDispatchQueue(supabase, TENANT_ID, {
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    resendApiKey: process.env.RESEND_API_KEY!,
    resendFromEmail: process.env.RESEND_FROM_EMAIL || "cotizaciones@tudominio.com",
    whatsappTemplateName: "quotation_resin_price",
    senderName: "Equipo Comercial",
    companyName: "Petroquimica",
    defaultPaymentTerms: "CAD / 30 dias",
    defaultShipmentEstimate: "4-6 semanas",
    batchSize: 50,
    delayBetweenSendsMs: 1000,
  });

  // Update quotation final status
  const finalStatus = result.failed > 0 && result.sent > 0
    ? "partially_sent"
    : result.failed > 0
      ? "failed"
      : "sent";

  await supabase
    .from("quotations")
    .update({
      status: finalStatus,
      total_dispatched: result.sent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quotationId);

  return NextResponse.json({
    quotationId,
    result,
    finalStatus,
  });
}
