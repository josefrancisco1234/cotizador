/**
 * Dictionary-based grade scanner.
 *
 * Instead of relying purely on LLM/regex to guess grade codes from email text,
 * this scanner takes the known grade codes from product_grades (BD0_DICCIONARIO)
 * and searches for them directly in the email text.
 *
 * This guarantees that every grade we know about will be found if it appears
 * in the email, regardless of surrounding text like "Icelene HB3553" or
 * "LD220C mi2 with add".
 */

import { ParsedPriceRow } from "./email-parser";
import { expandGrades } from "./grade-normalizer";

/**
 * Given plain text (with optional | separators for table rows) and a list of
 * known grade codes, scans each line for grade code occurrences and extracts
 * the associated price from the same line.
 *
 * Returns ParsedPriceRow[] containing only rows where a price was found.
 */
export function matchGradesInText(
  text: string,
  gradeCodes: string[],
  defaultIncoterm = "CFR",
  defaultPort = "CALLAO",
): ParsedPriceRow[] {
  // Sort longer codes first to prefer "LLF-4118C" over "LLF" if both exist
  const sorted = [...new Set(gradeCodes)].sort((a, b) => b.length - a.length);

  const found = new Map<string, ParsedPriceRow>(); // normalizedKey -> row

  const lines = text.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    for (const gc of sorted) {
      const normalizedKey = gc.toUpperCase().replace(/[\s\-\.]/g, "");
      if (found.has(normalizedKey)) continue;

      // Build word-boundary-like regex. Grade codes can contain hyphens (HB-W952-A).
      // We require: NOT preceded/followed by alphanumeric chars (hyphens OK in middle).
      const escaped = gc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");

      if (re.test(line)) {
        const price = extractPriceFromLine(line);
        if (price === null) continue; // line has the grade code but no price — skip

        const incoterm = extractIncoterm(line) || defaultIncoterm;
        const port = extractPort(line) || defaultPort;

        found.set(normalizedKey, {
          rawGradeText: gc,
          expandedGrades: expandGrades(gc),
          rawPriceText: String(price),
          priceUsd: price,
          incoterm,
          port,
        });
      }
    }
  }

  return Array.from(found.values());
}

/**
 * Merge two lists of ParsedPriceRow, preferring rows from `primary`.
 * Rows in `secondary` are added only if no row in `primary` shares the same
 * normalized grade code.
 */
export function mergeParseRows(
  primary: ParsedPriceRow[],
  secondary: ParsedPriceRow[],
): ParsedPriceRow[] {
  const keys = new Set(
    primary.map((r) => r.rawGradeText.toUpperCase().replace(/[\s\-\.]/g, "")),
  );

  const extras = secondary.filter(
    (r) => !keys.has(r.rawGradeText.toUpperCase().replace(/[\s\-\.]/g, "")),
  );

  return [...primary, ...extras];
}

// ── Price extraction ─────────────────────────────────────────────────────────

function extractPriceFromLine(line: string): number | null {
  // 1. Explicit $-prefixed prices: $1,120 or $1120
  for (const m of line.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (val >= 300 && val <= 5000) return val;
  }

  // 2. Bare numbers in price range (300-5000) — check each segment
  for (const m of line.matchAll(/\b(\d{3,4}(?:\.\d+)?)\b/g)) {
    const val = parseFloat(m[1]);
    if (val >= 300 && val <= 5000) return val;
  }

  return null;
}

function extractIncoterm(line: string): string | null {
  const m = line.match(/\b(CFR|CIF|FOB|DDP)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function extractPort(line: string): string | null {
  const upper = line.toUpperCase();
  if (upper.includes("CALLAO") || upper.includes("PECLL")) return "CALLAO";
  if (upper.includes("GUAYAQUIL") || upper.includes("GYE")) return "GUAYAQUIL";
  if (upper.includes("BUENAVENTURA")) return "BUENAVENTURA";
  if (upper.includes("SANTOS")) return "SANTOS";
  return null;
}
