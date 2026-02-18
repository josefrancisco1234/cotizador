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
