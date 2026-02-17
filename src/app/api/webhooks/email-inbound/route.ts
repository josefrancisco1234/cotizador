import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmailHtml } from "@/lib/engine/email-parser";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/webhooks/email-inbound - Receive forwarded emails (Resend inbound webhook)
 *
 * Expected body from Resend inbound:
 * { from, to, subject, html, text, message_id, ... }
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { from, subject, html, message_id } = body;

  if (!html) {
    return NextResponse.json({ error: "No HTML body in email" }, { status: 400 });
  }

  // Idempotency check
  if (message_id) {
    const { data: existing } = await supabase
      .from("price_ingestions")
      .select("id")
      .eq("tenant_id", TENANT_ID)
      .eq("source_identifier", message_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: "Already processed", id: existing.id });
    }
  }

  // Parse HTML
  const parseResult = parseEmailHtml(html);

  // Create ingestion
  const { data: ingestion, error: ingErr } = await supabase
    .from("price_ingestions")
    .insert({
      tenant_id: TENANT_ID,
      source_type: "email",
      source_identifier: message_id || null,
      source_subject: subject || null,
      source_from: from || null,
      raw_html: html,
      parsed_data: parseResult,
      status: parseResult.rows.length > 0 ? "pending" : "failed",
      grades_found: parseResult.rows.reduce((sum, r) => sum + r.expandedGrades.length, 0),
    })
    .select()
    .single();

  if (ingErr) {
    return NextResponse.json({ error: ingErr.message }, { status: 500 });
  }

  // Create price entries
  const priceEntries = [];
  for (const row of parseResult.rows) {
    for (const gradeCode of row.expandedGrades) {
      priceEntries.push({
        tenant_id: TENANT_ID,
        ingestion_id: ingestion.id,
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

  return NextResponse.json({
    message: "Ingestion created",
    id: ingestion.id,
    gradesFound: priceEntries.length,
  }, { status: 201 });
}
