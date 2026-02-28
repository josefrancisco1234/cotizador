import { NextRequest, NextResponse } from "next/server";
import { parseEmailHtml } from "@/lib/engine/email-parser";
import { parseEmailWithLLM } from "@/lib/engine/llm-parser";

/**
 * POST /api/formats/parse-preview
 * Parses raw text or HTML and returns extracted rows WITHOUT saving.
 * Uses GPT if configured, falls back to regex parser.
 */
export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(text);
  const htmlToParse = isHtml ? text : `<div>${text.replace(/\n/g, "<br/>")}</div>`;

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

  return NextResponse.json({
    rows: result.rows.map((r) => ({
      grade: r.rawGradeText,
      expandedGrades: r.expandedGrades,
      price: r.priceUsd,
      rawPrice: r.rawPriceText,
      incoterm: r.incoterm,
      port: r.port,
    })),
    warnings: result.warnings,
    tableCount: result.tableCount,
    parser: usedLLM ? "gpt-4o-mini" : "regex",
  });
}
