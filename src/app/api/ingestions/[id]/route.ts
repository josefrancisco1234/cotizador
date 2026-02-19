import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: ingestion, error } = await supabase
    .from("price_ingestions")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("id", id)
    .single();

  if (error || !ingestion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: entries } = await supabase
    .from("price_entries")
    .select(`
      id, raw_grade_text, raw_price_text, price_usd, incoterm, port,
      is_matched, match_confidence,
      grade:product_grades(grade_code, family:material_families(code, display_name))
    `)
    .eq("ingestion_id", id)
    .order("created_at");

  return NextResponse.json({ ingestion, entries: entries || [] });
}

/**
 * DELETE /api/ingestions/[id]
 * Removes the ingestion and all cascaded data:
 * quotation_recipients → quotation_items → quotations → price_entries → ingestion
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Verify ownership
  const { data: ingestion } = await supabase
    .from("price_ingestions")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (!ingestion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade: quotations linked to this ingestion
  const { data: quotations } = await supabase
    .from("quotations")
    .select("id")
    .eq("ingestion_id", id)
    .eq("tenant_id", TENANT_ID);

  if (quotations && quotations.length > 0) {
    const qIds = quotations.map((q) => q.id);
    await supabase.from("quotation_recipients").delete().in("quotation_id", qIds);
    await supabase.from("quotation_items").delete().in("quotation_id", qIds);
    await supabase.from("quotations").delete().in("id", qIds);
  }

  // Delete price entries
  await supabase.from("price_entries").delete().eq("ingestion_id", id);

  // Delete the ingestion itself
  const { error } = await supabase
    .from("price_ingestions")
    .delete()
    .eq("id", id)
    .eq("tenant_id", TENANT_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
