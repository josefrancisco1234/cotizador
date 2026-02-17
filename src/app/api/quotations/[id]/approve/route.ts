import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { quotationApproveSchema } from "@/lib/validators/schemas";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/quotations/[id]/approve - Approve quotation and queue for dispatch
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: quotationId } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const parsed = quotationApproveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify quotation exists and is in draft state
  const { data: quotation, error: qErr } = await supabase
    .from("quotations")
    .select("id, status, total_recipients")
    .eq("id", quotationId)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (qErr || !quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  if (quotation.status !== "draft") {
    return NextResponse.json(
      { error: `Quotation is already ${quotation.status}` },
      { status: 400 },
    );
  }

  // Update quotation to approved
  const { error: updateErr } = await supabase
    .from("quotations")
    .update({
      status: "approved",
      payment_terms: parsed.data.paymentTerms,
      shipment_terms: parsed.data.shipmentTerms,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quotationId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Queue all pending recipients
  const { error: queueErr } = await supabase
    .from("quotation_recipients")
    .update({ dispatch_status: "queued" })
    .eq("quotation_id", quotationId)
    .eq("dispatch_status", "pending");

  if (queueErr) {
    return NextResponse.json({ error: queueErr.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Quotation approved and queued for dispatch",
    quotationId,
    recipientsQueued: quotation.total_recipients,
  });
}
