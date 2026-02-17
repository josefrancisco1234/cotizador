/**
 * Email HTML Parser
 *
 * Extracts grade/price pairs from HTML email bodies sent by suppliers.
 * Handles variable table structures and inconsistent formatting.
 */

import { expandGrades, normalizePrice } from "./grade-normalizer";

export interface ParsedPriceRow {
  rawGradeText: string;
  expandedGrades: string[];
  rawPriceText: string;
  priceUsd: number | null;
  incoterm: string;
  port: string;
}

export interface ParseResult {
  rows: ParsedPriceRow[];
  warnings: string[];
  tableCount: number;
}

/**
 * Parse HTML email body and extract grade/price pairs.
 */
export function parseEmailHtml(html: string): ParseResult {
  const warnings: string[] = [];
  const rows: ParsedPriceRow[] = [];

  // Extract all tables from HTML
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables = html.match(tableRegex) || [];

  if (tables.length === 0) {
    warnings.push("No HTML tables found, attempting line-by-line parse");
    return { rows: parseTextFallback(html, warnings), warnings, tableCount: 0 };
  }

  for (const tableHtml of tables) {
    const tableRows = extractTableRows(tableHtml);
    for (const cells of tableRows) {
      const parsed = parseRowCells(cells);
      if (parsed) {
        rows.push(parsed);
      }
    }
  }

  if (rows.length === 0) {
    warnings.push("Tables found but no grade/price pairs extracted");
  }

  return { rows, warnings, tableCount: tables.length };
}

/**
 * Extract rows from an HTML table. Returns array of cell text arrays.
 */
function extractTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      // Strip HTML tags and decode entities
      const text = stripHtml(cellMatch[1]).trim();
      cells.push(text);
    }

    if (cells.length >= 2) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Try to parse a row of cells into a grade/price pair.
 * Heuristic: look for a cell with grade-like text and a cell with price-like text.
 */
function parseRowCells(cells: string[]): ParsedPriceRow | null {
  // Skip header rows
  const headerKeywords = ["grade", "grado", "precio", "price", "material", "product"];
  const isHeader = cells.some((c) =>
    headerKeywords.some((kw) => c.toLowerCase().includes(kw))
  );
  if (isHeader && cells.every((c) => !/\d{3,}/.test(c))) {
    return null; // Likely a header row
  }

  // Strategy: find the cell that looks like a grade and the cell that looks like a price
  let gradeText: string | null = null;
  let priceText: string | null = null;

  for (const cell of cells) {
    if (!cell) continue;

    // Price detection: contains digits with comma/dot separators, possibly with USD
    if (
      !priceText &&
      /(?:USD|US\$|\$)?\s*\d{1,3}[,.]?\d{3}(?:[,.]\d{1,2})?/.test(cell)
    ) {
      priceText = cell;
      continue;
    }

    // Grade detection: alphanumeric codes (letters + numbers)
    if (!gradeText && /[A-Za-z].*\d|\d.*[A-Za-z]/.test(cell)) {
      gradeText = cell;
      continue;
    }

    // Fallback: pure number could be price
    if (!priceText && /^\d{3,}$/.test(cell.replace(/[,.\s]/g, ""))) {
      priceText = cell;
      continue;
    }

    // Fallback: if we have a grade but no price, try this cell
    if (gradeText && !priceText) {
      priceText = cell;
    }
  }

  if (!gradeText) return null;

  const expandedGrades = expandGrades(gradeText);
  const priceUsd = priceText ? normalizePrice(priceText) : null;

  // Detect incoterm and port from surrounding text
  const fullText = cells.join(" ");
  const incoterm = detectIncoterm(fullText);
  const port = detectPort(fullText);

  return {
    rawGradeText: gradeText,
    expandedGrades,
    rawPriceText: priceText || "",
    priceUsd,
    incoterm,
    port,
  };
}

/**
 * Fallback parser for non-table email content.
 * Looks for patterns like "GRADE — PRICE" or "GRADE: PRICE"
 */
function parseTextFallback(text: string, warnings: string[]): ParsedPriceRow[] {
  const rows: ParsedPriceRow[] = [];
  const cleanText = stripHtml(text);
  const lines = cleanText.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Pattern: "GRADE_CODE — PRICE" or "GRADE_CODE - PRICE" or "GRADE_CODE PRICE"
    const match = line.match(
      /([A-Za-z0-9\-\/\s]+?)\s*[—\-:]\s*(\$?\s*[\d,.\s]+)/
    );
    if (match) {
      const gradeText = match[1].trim();
      const priceText = match[2].trim();

      // Filter out obvious non-grades
      if (gradeText.length < 2 || gradeText.length > 50) continue;

      const expandedGrades = expandGrades(gradeText);
      const priceUsd = normalizePrice(priceText);

      if (expandedGrades.length > 0) {
        rows.push({
          rawGradeText: gradeText,
          expandedGrades,
          rawPriceText: priceText,
          priceUsd,
          incoterm: detectIncoterm(line),
          port: detectPort(line),
        });
      }
    }
  }

  if (rows.length === 0) {
    warnings.push("Text fallback parser found no grade/price pairs");
  }

  return rows;
}

function detectIncoterm(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes("CIF")) return "CIF";
  if (upper.includes("FOB")) return "FOB";
  if (upper.includes("CFR")) return "CFR";
  if (upper.includes("DDP")) return "DDP";
  return "CFR"; // default
}

function detectPort(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes("CALLAO") || upper.includes("PECLL")) return "CALLAO";
  if (upper.includes("LIMA")) return "CALLAO";
  if (upper.includes("BUENAVENTURA")) return "BUENAVENTURA";
  return "CALLAO"; // default for Peru
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
