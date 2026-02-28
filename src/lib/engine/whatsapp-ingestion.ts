/**
 * WhatsApp message ingestion — NO LLM, zero token cost.
 * Uses only regex parser + dictionary scan.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { parseEmailHtml } from "./email-parser";
import { stripToText } from "./llm-parser";
import { matchGradesInText, mergeParseRows } from "./dictionary-matcher";
import { findUnknownGrades, saveUnknownGrades } from "./unknown-grades";

interface WhatsAppMessage {
  messageId: string;   // wamid_xxx — used for idempotency
  from: string;        // phone number e.g. "51999999999"
  body: string;        // raw text from the message
  timestamp?: string;  // unix timestamp from Meta
}

interface IngestResult {
  ingestionId: string | null;
  gradesFound: number;
  skipped: boolean;    // true when no grades/prices detected (normal chat messages)
}

export async function processWhatsAppMessage(
  supabase: SupabaseClient,
  tenantId: string,
  msg: WhatsAppMessage,
): Promise<IngestResult> {
  // Idempotency: skip if already processed
  const { data: existing } = await supabase
    .from("price_ingestions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source_identifier", msg.messageId)
    .maybeSingle();

  if (existing) {
    return { ingestionId: existing.id, gradesFound: 0, skipped: true };
  }

  // Wrap plain text as HTML so the regex parser can handle it
  const html = `<div>${msg.body.replace(/\n/g, "<br/>")}</div>`;

  // ── Step 1: Regex parse (NO LLM) ──────────────────────────────────────────
  let parseResult = parseEmailHtml(html);

  // ── Step 2: Dictionary scan ───────────────────────────────────────────────
  const { data: gradeRows } = await supabase
    .from("product_grades")
    .select("grade_code")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (gradeRows && gradeRows.length > 0) {
    const gradeCodes = gradeRows.map((r: { grade_code: string }) => r.grade_code);
    const norm = (s: string) => s.toUpperCase().replace(/[\s\-\.]/g, "");
    const knownSet = new Set(gradeCodes.map(norm));

    const plainText = stripToText(html);
    const dictMatches = matchGradesInText(plainText, gradeCodes);
    const merged = mergeParseRows(parseResult.rows, dictMatches);

    const knownRows = merged.filter((r) =>
      r.expandedGrades.some((g) => knownSet.has(norm(g))),
    );
    const unknownRows = merged.filter((r) =>
      r.expandedGrades.every((g) => !knownSet.has(norm(g))),
    );

    // Save unknowns silently
    const unknown = findUnknownGrades(
      unknownRows.map((r) => r.expandedGrades),
      gradeCodes,
    );
    await saveUnknownGrades(supabase, tenantId, unknown, "ingestion");

    parseResult = { ...parseResult, rows: knownRows };
  }

  // If no grades found → this is a normal chat message, skip silently
  if (parseResult.rows.length === 0) {
    return { ingestionId: null, gradesFound: 0, skipped: true };
  }

  // ── Step 3: Save ingestion ────────────────────────────────────────────────
  const sourceDate = msg.timestamp
    ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { data: ingestion, error: ingErr } = await supabase
    .from("price_ingestions")
    .insert({
      tenant_id: tenantId,
      source_type: "whatsapp",
      source_identifier: msg.messageId,
      source_from: msg.from,
      source_subject: null,
      source_date: sourceDate,
      raw_html: html,
      parsed_data: parseResult,
      status: "processing",
      grades_found: parseResult.rows.reduce((sum, r) => sum + r.expandedGrades.length, 0),
    })
    .select("id")
    .single();

  if (ingErr) {
    console.error("WhatsApp ingestion insert error:", ingErr.message);
    return { ingestionId: null, gradesFound: 0, skipped: false };
  }

  // ── Step 4: Save price entries ────────────────────────────────────────────
  const priceEntries = [];
  for (const row of parseResult.rows) {
    for (const gradeCode of row.expandedGrades) {
      priceEntries.push({
        tenant_id: tenantId,
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
    const { error: peErr } = await supabase.from("price_entries").insert(priceEntries);
    if (peErr) console.error("WhatsApp price entries error:", peErr.message);
  }

  return {
    ingestionId: ingestion.id,
    gradesFound: priceEntries.length,
    skipped: false,
  };
}
