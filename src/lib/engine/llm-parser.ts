/**
 * LLM-based email parser using OpenAI GPT.
 * Replaces regex heuristics with a language model that can understand
 * any email format from any supplier.
 */

import OpenAI from "openai";
import { ParseResult, ParsedPriceRow } from "./email-parser";
import { expandGrades } from "./grade-normalizer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an assistant that extracts resin price data from supplier emails.

Extract ALL grade/price pairs from the email. For each item return:
- grade: the product grade code (e.g. "LD220C", "PP4300", "PC02-20UR", "HB3553")
  - Extract ONLY the grade code, NOT brand names or specs descriptions
  - If a cell contains "Icelene HB3553" the grade is "HB3553"
  - If a cell contains "LD220C mi2 with add" the grade is "LD220C"
  - If a cell contains "LLF-4118C mi1 with add" the grade is "LLF-4118C"
- price: numeric price in USD per metric ton (number only, no symbols)
- incoterm: "CFR", "FOB", "CIF", or "DDP" (default "CFR" if not stated)
- port: destination port, usually "CALLAO" for Peru (default "CALLAO")

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"rows":[{"grade":"XX","price":1000,"incoterm":"CFR","port":"CALLAO"},...]}

Rules:
- Skip rows with no price or no grade code
- Skip header rows, totals, notes
- If price has commas (1,000) treat as thousands separator → 1000
- Prices are typically between 300 and 5000 USD/MT for plastics`;

export async function parseEmailWithLLM(html: string): Promise<ParseResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Strip HTML to plain text to reduce tokens
  const text = stripToText(html);

  // Truncate to avoid token limits (keep first 6000 chars — enough for any price email)
  const truncated = text.length > 6000 ? text.slice(0, 6000) + "\n[truncated]" : text;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // cheap, fast, very capable for structured extraction
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: truncated },
    ],
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content || "{}";
  let parsed: { rows?: Array<{ grade: string; price: number; incoterm: string; port: string }> };

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`GPT returned invalid JSON: ${content.slice(0, 200)}`);
  }

  const rawRows = parsed.rows || [];
  const rows: ParsedPriceRow[] = rawRows
    .filter((r) => r.grade && r.price > 0)
    .map((r) => ({
      rawGradeText: r.grade,
      expandedGrades: expandGrades(r.grade),
      rawPriceText: String(r.price),
      priceUsd: r.price,
      incoterm: r.incoterm || "CFR",
      port: r.port || "CALLAO",
    }));

  return {
    rows,
    warnings: rows.length === 0 ? ["GPT found no grade/price pairs"] : [],
    tableCount: 0,
  };
}

export function stripToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/th>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
