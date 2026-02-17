import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/quotations - List all quotations
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("quotations")
    .select(`
      id, title, status, payment_terms, shipment_terms,
      total_recipients, total_dispatched, approved_at, created_at,
      ingestion:price_ingestions(source_subject)
    `)
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
