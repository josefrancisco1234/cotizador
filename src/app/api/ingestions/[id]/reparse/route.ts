import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmailHtml } from "@/lib/engine/email-parser";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/ingestions/[id]/reparse
 * Delete existing price entries and re-run parser on raw_html.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Get the ingestion
  const { data: ingestion, error } = await supabase
    .from("price_ingestions")
    .select("id, raw_html, status")
    .eq("tenant_id", TENANT_ID)
    .eq("id", id)
    .single();

  if (error || !ingestion) {
    return NextResponse.json({ error: "Ingestion not found" }, { status: 404 });
  }

  if (!ingestion.raw_html) {
    return NextResponse.json({ error: "No raw HTML stored for this ingestion" }, { status: 400 });
  }

  // Delete existing price entries
  await supabase.from("price_entries").delete().eq("ingestion_id", id);

  // Re-parse the HTML
  const parseResult = parseEmailHtml(ingestion.raw_html);

  // Create new price entries
  const priceEntries = [];
  for (const row of parseResult.rows) {
    for (const gradeCode of row.expandedGrades) {
      priceEntries.push({
        tenant_id: TENANT_ID,
        ingestion_id: id,
        raw_grade_text: gradeCode,
        raw_price_text: row.rawPriceText,
        price_usd: row.priceUsd,
        incoterm: row.incoterm,
        port: row.port,
      });
    }
  }

  if (priceEntries.length > 0) {
    await supabase.from("price_entries").insert(priceEntries);
  }

  // Update ingestion status back to pending for re-matching
  await supabase
    .from("price_ingestions")
    .update({
      grades_found: priceEntries.length,
      grades_matched: 0,
      grades_unknown: 0,
      parsed_data: parseResult,
      status: "pending",
    })
    .eq("id", id);

  return NextResponse.json({
    message: "Re-parsed successfully",
    gradesFound: priceEntries.length,
    warnings: parseResult.warnings,
  });
}
