import { NextRequest, NextResponse } from "next/server";
import { parseEmailHtml } from "@/lib/engine/email-parser";

/**
 * POST /api/formats/parse-preview
 * Parses raw text or HTML and returns extracted rows WITHOUT saving anything.
 * Used by the formats test UI.
 */
export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  // If text doesn't look like HTML, wrap in a simple structure
  // so the parser can use text fallback mode
  const isHtml = /<[a-z][\s\S]*>/i.test(text);
  const htmlToparse = isHtml ? text : `<div>${text.replace(/\n/g, "<br/>")}</div>`;

  const result = parseEmailHtml(htmlToparse);

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
  });
}
