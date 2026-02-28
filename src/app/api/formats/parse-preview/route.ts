import { NextRequest, NextResponse } from "next/server";
import { parseEmailHtml } from "@/lib/engine/email-parser";
import { parseEmailWithLLM, stripToText } from "@/lib/engine/llm-parser";
import { matchGradesInText, mergeParseRows } from "@/lib/engine/dictionary-matcher";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/formats/parse-preview
 * Parses raw text or HTML and returns extracted rows WITHOUT saving.
 *
 * Also returns `unknownGrades`: grade codes found by the parser that do NOT
 * exist in product_grades (BD0_DICCIONARIO). These can be added to the Excel
 * later to grow the dictionary.
 */
export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(text);
  const htmlToParse = isHtml ? text : `<div>${text.replace(/\n/g, "<br/>")}</div>`;

  // ── Step 1: LLM or regex primary parse ──────────────────────────────────
  let result;
  let usedLLM = false;

  if (process.env.OPENAI_API_KEY) {
    try {
      result = await parseEmailWithLLM(htmlToParse);
      usedLLM = true;
    } catch (err) {
      console.error("LLM parse failed:", (err as Error).message);
      result = parseEmailHtml(htmlToParse);
    }
  } else {
    result = parseEmailHtml(htmlToParse);
  }

  // ── Step 2: Dictionary scan + unknown detection ─────────────────────────
  const unknownGrades: string[] = [];

  try {
    const supabase = createAdminClient();
    const { data: gradeRows } = await supabase
      .from("product_grades")
      .select("grade_code")
      .eq("tenant_id", TENANT_ID)
      .eq("is_active", true);

    if (gradeRows && gradeRows.length > 0) {
      const gradeCodes = gradeRows.map((r: { grade_code: string }) => r.grade_code);
      const norm = (s: string) => s.toUpperCase().replace(/[\s\-\.]/g, "");
      const knownSet = new Set(gradeCodes.map(norm));

      // Augment with dictionary matches
      const plainText = stripToText(htmlToParse);
      const dictMatches = matchGradesInText(plainText, gradeCodes);
      result = { ...result, rows: mergeParseRows(result.rows, dictMatches) };

      // Detect which extracted grades are NOT in the dictionary
      for (const row of result.rows) {
        const allKnown = row.expandedGrades.every((g) => knownSet.has(norm(g)));
        if (!allKnown) {
          // Collect the unknown ones
          for (const g of row.expandedGrades) {
            if (!knownSet.has(norm(g))) unknownGrades.push(g);
          }
        }
      }
    }
  } catch (err) {
    console.error("Dictionary scan failed:", (err as Error).message);
  }

  return NextResponse.json({
    rows: result.rows.map((r) => ({
      grade: r.rawGradeText,
      expandedGrades: r.expandedGrades,
      price: r.priceUsd,
      rawPrice: r.rawPriceText,
      incoterm: r.incoterm,
      port: r.port,
    })),
    unknownGrades,
    warnings: result.warnings,
    tableCount: result.tableCount,
    parser: usedLLM ? "gpt-4o-mini" : "regex",
  });
}
