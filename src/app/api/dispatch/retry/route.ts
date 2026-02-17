import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDispatchQueue } from "@/lib/dispatch/queue";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/dispatch/retry - Process retry queue (called by Vercel Cron)
 *
 * Picks up failed recipients whose next_retry_at has passed
 * and re-queues them for dispatch.
 */
export async function POST() {
  const supabase = createAdminClient();

  // Re-queue failed recipients whose retry time has passed
  const { data: retryable, error: retryErr } = await supabase
    .from("quotation_recipients")
    .update({ dispatch_status: "pending" })
    .eq("tenant_id", TENANT_ID)
    .eq("dispatch_status", "failed")
    .lte("next_retry_at", new Date().toISOString())
    .not("next_retry_at", "is", null)
    .select("id");

  if (retryErr) {
    return NextResponse.json({ error: retryErr.message }, { status: 500 });
  }

  const requeuedCount = retryable?.length || 0;

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
    batchSize: 20,
    delayBetweenSendsMs: 2000,
  });

  return NextResponse.json({
    requeued: requeuedCount,
    dispatched: result,
  });
}
