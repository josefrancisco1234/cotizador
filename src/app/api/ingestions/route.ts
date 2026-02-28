import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestionCreateSchema } from "@/lib/validators/schemas";
import { parseEmailHtml } from "@/lib/engine/email-parser";
import { parseEmailWithLLM } from "@/lib/engine/llm-parser";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/ingestions - List all price ingestions
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("price_ingestions")
    .select("id, source_type, source_subject, source_from, status, grades_found, grades_matched, grades_unknown, created_at")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/**
 * POST /api/ingestions - Create new ingestion from HTML email content
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const parsed = ingestionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rawHtml, sourceSubject, sourceFrom, sourceIdentifier, supplierId } = parsed.data;

  // Check idempotency on source_identifier
  if (sourceIdentifier) {
    const { data: existing } = await supabase
      .from("price_ingestions")
      .select("id")
      .eq("tenant_id", TENANT_ID)
      .eq("source_identifier", sourceIdentifier)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Email already processed", existingId: existing.id },
        { status: 409 },
      );
    }
  }

  // Parse: try GPT first, fall back to regex parser
  let parseResult;
  let usedLLM = false;
  if (process.env.OPENAI_API_KEY) {
    try {
      parseResult = await parseEmailWithLLM(rawHtml);
      usedLLM = true;
    } catch (llmErr) {
      console.error("LLM parse failed, falling back to regex:", (llmErr as Error).message);
      parseResult = parseEmailHtml(rawHtml);
    }
  } else {
    parseResult = parseEmailHtml(rawHtml);
  }

  // Create ingestion record
  const { data: ingestion, error: ingErr } = await supabase
    .from("price_ingestions")
    .insert({
      tenant_id: TENANT_ID,
      supplier_id: supplierId || null,
      source_type: "email",
      source_identifier: sourceIdentifier || null,
      source_subject: sourceSubject || null,
      source_from: sourceFrom || null,
      raw_html: rawHtml,
      parsed_data: parseResult,
      status: parseResult.rows.length > 0 ? "processing" : "failed",
      error_message: parseResult.rows.length === 0 ? "No grade/price pairs found" : null,
      grades_found: parseResult.rows.reduce((sum, r) => sum + r.expandedGrades.length, 0),
    })
    .select()
    .single();

  if (ingErr) {
    return NextResponse.json({ error: ingErr.message }, { status: 500 });
  }

  // Create price entries for each parsed row
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
    const { error: peErr } = await supabase
      .from("price_entries")
      .insert(priceEntries);

    if (peErr) {
      console.error("Price entries insert error:", peErr.message);
    }
  }

  return NextResponse.json({
    data: ingestion,
    parsed: {
      rowsFound: parseResult.rows.length,
      gradesExpanded: priceEntries.length,
      warnings: parseResult.warnings,
      parser: usedLLM ? "gpt" : "regex",
    },
  }, { status: 201 });
}
