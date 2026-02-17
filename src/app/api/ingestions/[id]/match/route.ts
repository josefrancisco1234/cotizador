import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchGradeToRecipients } from "@/lib/engine/matching-engine";
import { normalizeGradeCode } from "@/lib/engine/grade-normalizer";
import { generateIdempotencyKey } from "@/lib/utils/idempotency";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/ingestions/[id]/match - Run matching engine on all price entries
 *
 * Finds matching clients for each grade and creates a quotation with recipients.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ingestionId } = await params;
  const supabase = createAdminClient();

  // Fetch price entries for this ingestion
  const { data: entries, error: entriesErr } = await supabase
    .from("price_entries")
    .select("*")
    .eq("ingestion_id", ingestionId)
    .eq("tenant_id", TENANT_ID);

  if (entriesErr || !entries) {
    return NextResponse.json({ error: "Failed to fetch price entries" }, { status: 500 });
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "No price entries found for this ingestion" }, { status: 404 });
  }

  // Run matching for each entry
  const matchResults: Array<{
    gradeCode: string;
    priceUsd: number;
    status: string;
    recipientCount: number;
    warnings: string[];
    candidates?: { id: string; gradeCode: string }[];
  }> = [];
  let totalMatched = 0;
  let totalUnknown = 0;

  for (const entry of entries) {
    const result = await matchGradeToRecipients(
      supabase,
      TENANT_ID,
      entry.raw_grade_text,
      entry.price_usd,
    );

    // Update price entry with grade match
    if (result.grade) {
      await supabase
        .from("price_entries")
        .update({
          grade_id: result.grade.id,
          is_matched: true,
          match_confidence: result.status === "matched" ? 1.0 : 0.8,
        })
        .eq("id", entry.id);
      totalMatched++;
    } else {
      totalUnknown++;
    }

    matchResults.push({
      gradeCode: entry.raw_grade_text,
      priceUsd: entry.price_usd,
      status: result.status,
      recipientCount: result.recipients.length,
      warnings: result.warnings,
      candidates: result.candidates,
    });
  }

  // Create quotation with matched items
  const matchedEntries = entries.filter((e) =>
    matchResults.find(
      (r) => r.gradeCode === e.raw_grade_text && r.status === "matched",
    ),
  );

  let quotationId: string | null = null;

  if (matchedEntries.length > 0) {
    // Create quotation
    const { data: quotation, error: qErr } = await supabase
      .from("quotations")
      .insert({
        tenant_id: TENANT_ID,
        ingestion_id: ingestionId,
        title: `Cotizacion - ${new Date().toLocaleDateString("es-PE")}`,
        status: "draft",
        payment_terms: "CAD / 30 dias",
        shipment_terms: "4-6 semanas",
      })
      .select()
      .single();

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }
    quotationId = quotation.id;

    // Create quotation items
    for (const entry of matchedEntries) {
      const matchResult = matchResults.find(
        (r) => r.gradeCode === entry.raw_grade_text && r.status === "matched",
      );
      if (!matchResult) continue;

      // Re-fetch grade_id from updated entry
      const { data: updatedEntry } = await supabase
        .from("price_entries")
        .select("grade_id")
        .eq("id", entry.id)
        .single();

      if (updatedEntry?.grade_id) {
        await supabase.from("quotation_items").insert({
          quotation_id: quotation.id,
          price_entry_id: entry.id,
          grade_id: updatedEntry.grade_id,
          price_usd: entry.price_usd,
        });
      }
    }

    // Create recipients from match results
    const today = new Date().toISOString().split("T")[0];
    let totalRecipients = 0;

    for (const matchResult of matchResults) {
      if (matchResult.status !== "matched") continue;

      const fullResult = await matchGradeToRecipients(
        supabase,
        TENANT_ID,
        matchResult.gradeCode,
        matchResult.priceUsd,
      );

      for (const recipient of fullResult.recipients) {
        const idempotencyKey = generateIdempotencyKey({
          tenantId: TENANT_ID,
          clientId: recipient.clientId,
          gradeId: fullResult.grade!.id,
          priceUsd: matchResult.priceUsd,
          date: today,
        });

        const { error: recipErr } = await supabase
          .from("quotation_recipients")
          .insert({
            tenant_id: TENANT_ID,
            quotation_id: quotation.id,
            client_id: recipient.clientId,
            contact_id: recipient.contactId,
            channel: recipient.channel,
            idempotency_key: idempotencyKey,
          });

        if (!recipErr) totalRecipients++;
      }
    }

    // Update quotation recipient count
    await supabase
      .from("quotations")
      .update({ total_recipients: totalRecipients })
      .eq("id", quotation.id);
  }

  // Update ingestion status
  await supabase
    .from("price_ingestions")
    .update({
      status: totalUnknown === entries.length ? "partial" : "completed",
      grades_matched: totalMatched,
      grades_unknown: totalUnknown,
      processed_at: new Date().toISOString(),
    })
    .eq("id", ingestionId);

  return NextResponse.json({
    ingestionId,
    quotationId,
    matchResults,
    summary: {
      totalEntries: entries.length,
      matched: totalMatched,
      unknown: totalUnknown,
    },
  });
}
