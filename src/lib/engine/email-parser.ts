/**
 * Email HTML Parser
 *
 * Extracts grade/price pairs from HTML email bodies sent by suppliers.
 * Handles variable table structures and inconsistent formatting.
 *
 * Strategy:
 * 1. For each table, read the first row as potential header.
 * 2. If header columns identify "grade" and "price" columns → use them directly.
 * 3. Otherwise → fall back to cell-by-cell heuristic.
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

interface ColumnMap {
  gradeCol: number;
  priceCol: number;
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

  // Detect incoterm/port from the full email body (headers like "CFR PECLL" live there)
  const fullText = stripHtml(html);
  const emailIncoterm = detectIncoterm(fullText);
  const emailPort = detectPort(fullText);

  for (const tableHtml of tables) {
    const tableRows = extractAllRows(tableHtml);
    if (tableRows.length < 2) continue;

    // Try to detect column positions from the first (header) row
    const columnMap = detectColumnMap(tableRows[0]);

    if (columnMap) {
      // ── Header-guided parsing ──────────────────────────────────────────────
      for (let i = 1; i < tableRows.length; i++) {
        const cells = tableRows[i];
        if (cells.length <= Math.max(columnMap.gradeCol, columnMap.priceCol)) continue;

        const gradeText = cells[columnMap.gradeCol]?.trim() || "";
        const priceText = cells[columnMap.priceCol]?.trim() || "";

        if (!gradeText || !priceText) continue;

        // Skip rows where the "grade" cell looks like a sub-header or section label
        // (all letters, no digits — e.g. "Nhat Huy Group")
        if (!/\d/.test(gradeText)) continue;

        const expandedGrades = expandGrades(gradeText);
        if (expandedGrades.length === 0) continue;

        const priceUsd = normalizePrice(priceText);
        if (!priceUsd) continue;

        rows.push({
          rawGradeText: gradeText,
          expandedGrades,
          rawPriceText: priceText,
          priceUsd,
          incoterm: emailIncoterm,
          port: emailPort,
        });
      }
    } else {
      // ── Heuristic parsing (no recognizable header) ─────────────────────────
      for (const cells of tableRows) {
        const parsed = parseRowCells(cells, emailIncoterm, emailPort);
        if (parsed) {
          rows.push(parsed);
        }
      }
    }
  }

  if (rows.length === 0) {
    warnings.push("Tables found but no grade/price pairs extracted");
  }

  return { rows, warnings, tableCount: tables.length };
}

// ── Column-map detection ────────────────────────────────────────────────────

/**
 * Given the header row cells, return which column index holds grades and prices.
 * Returns null if we can't identify both columns.
 */
function detectColumnMap(headerCells: string[]): ColumnMap | null {
  let gradeCol = -1;
  let priceCol = -1;

  for (let i = 0; i < headerCells.length; i++) {
    const h = headerCells[i].toLowerCase();

    // Grade column: "Grade", "Grado", "Code", "Codigo", "Ref"
    if (gradeCol === -1 && /\b(grade|grado|cod(igo)?|code|ref(erencia)?)\b/.test(h)) {
      gradeCol = i;
      continue;
    }

    // Price column: "$", "USD", "Price", "Precio", "CFR", "FOB", "CIF", "/MT", "/TM", "/ton"
    if (priceCol === -1 && /(\$|price|precio|usd|cfr|fob|cif|costo|\/mt|\/tm|\/ton)/.test(h)) {
      priceCol = i;
    }
  }

  if (gradeCol === -1 || priceCol === -1) return null;
  return { gradeCol, priceCol };
}

// ── Row extraction ──────────────────────────────────────────────────────────

/**
 * Extract ALL rows (including header) from an HTML table.
 */
function extractAllRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const text = stripHtml(cellMatch[1]).trim();
      cells.push(text);
    }

    if (cells.length >= 2) {
      rows.push(cells);
    }
  }

  return rows;
}

// ── Heuristic row parser (fallback when no header map) ─────────────────────

/**
 * Try to parse a row of cells into a grade/price pair.
 * Heuristic: look for a cell with grade-like text and a cell with price-like text.
 */
function parseRowCells(
  cells: string[],
  emailIncoterm: string,
  emailPort: string,
): ParsedPriceRow | null {
  // Skip header rows
  const headerKeywords = ["grade", "grado", "precio", "price", "material", "product", "cfr", "fob", "cif"];
  const isHeader = cells.some((c) =>
    headerKeywords.some((kw) => c.toLowerCase() === kw || c.toLowerCase().startsWith(kw + " "))
  );
  if (isHeader && cells.every((c) => !/^\d{3,}$/.test(c.replace(/[,.\s]/g, "")))) {
    return null;
  }

  let gradeText: string | null = null;
  let priceText: string | null = null;

  for (const cell of cells) {
    if (!cell) continue;

    // Grade: starts with 1–6 letters then digits, length ≤ 30
    // But NOT pure "MI X" patterns (melt index specs)
    if (
      !gradeText &&
      /^[A-Za-z]{1,6}[\-\/]?[A-Za-z0-9\-\/\s]*\d/.test(cell) &&
      cell.length <= 30 &&
      !/^MI\s/i.test(cell) // exclude melt-index specs
    ) {
      gradeText = cell;
      continue;
    }

    // Price: standalone number possibly with currency symbol
    if (
      !priceText &&
      /^(?:USD|US\$|\$)?\s*\d[\d,.\s]*$/.test(cell.trim()) &&
      /\d{3,}/.test(cell.replace(/[,.\s]/g, ""))
    ) {
      priceText = cell;
      continue;
    }

    // Fallback: if grade is set and no price yet, any 3+ digit number
    if (gradeText && !priceText && /\d{3,}/.test(cell.replace(/[,.\s]/g, ""))) {
      // But reject cells that are themselves valid grade codes (start with letter)
      if (!/^[A-Za-z]/.test(cell.trim())) {
        priceText = cell;
      }
    }
  }

  if (!gradeText) return null;

  const expandedGrades = expandGrades(gradeText);
  const priceUsd = priceText ? normalizePrice(priceText) : null;

  const fullText = cells.join(" ");
  const incoterm = detectIncoterm(fullText) || emailIncoterm;
  const port = detectPort(fullText) || emailPort;

  return {
    rawGradeText: gradeText,
    expandedGrades,
    rawPriceText: priceText || "",
    priceUsd,
    incoterm,
    port,
  };
}

// ── Text fallback (no tables) ───────────────────────────────────────────────

/**
 * Fallback parser for non-table email content.
 * Tries multiple text patterns in order.
 */
function parseTextFallback(text: string, warnings: string[]): ParsedPriceRow[] {
  const rows: ParsedPriceRow[] = [];
  const cleanText = stripHtml(text);
  const lines = cleanText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const emailIncoterm = detectIncoterm(cleanText);
  const emailPort = detectPort(cleanText);

  for (const line of lines) {
    const result =
      tryPatternAt(line) ||
      tryPatternDashColon(line);

    if (result) {
      const expandedGrades = expandGrades(result.grade);
      const priceUsd = normalizePrice(result.price);
      if (expandedGrades.length > 0 && priceUsd) {
        rows.push({
          rawGradeText: result.grade,
          expandedGrades,
          rawPriceText: result.price,
          priceUsd,
          incoterm: detectIncoterm(line) || emailIncoterm,
          port: detectPort(line) || emailPort,
        });
      }
    }
  }

  if (rows.length === 0) {
    warnings.push("Text fallback parser found no grade/price pairs");
  }

  return rows;
}

/**
 * Pattern: "... GRADE @ US $PRICE/mt CFR PORT"
 * Extracts the last token before "@" that looks like a grade code.
 */
function tryPatternAt(line: string): { grade: string; price: string } | null {
  const atIdx = line.indexOf("@");
  if (atIdx === -1) return null;

  const beforeAt = line.slice(0, atIdx).trim();
  const afterAt = line.slice(atIdx + 1).trim();

  // Price after @: optional "US", optional "$", digits, optional "/mt"
  const priceMatch = afterAt.match(/^(?:US\s+)?\$?\s*([\d,]+(?:\.\d+)?)\s*\/\s*m[tT]/i);
  if (!priceMatch) return null;

  // Grade: last token before @ that starts with uppercase letter AND contains a digit
  const tokens = beforeAt.split(/\s+/);
  let grade: string | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^[A-Z][A-Za-z0-9\-\.]*\d/.test(tokens[i])) {
      grade = tokens[i];
      break;
    }
  }
  if (!grade) return null;

  return { grade, price: priceMatch[1] };
}

/**
 * Pattern: "GRADE — PRICE" or "GRADE: PRICE" or "GRADE - PRICE"
 */
function tryPatternDashColon(line: string): { grade: string; price: string } | null {
  const match = line.match(
    /^([A-Za-z][A-Za-z0-9\-\/\s]{1,40}?)\s*[—\-:]\s*(\$?\s*[\d,.\s]+)/
  );
  if (!match) return null;

  const grade = match[1].trim();
  const price = match[2].trim();

  if (grade.length < 2 || grade.length > 50) return null;
  if (!/\d/.test(grade)) return null; // grade must contain a digit
  if (!/\d{3,}/.test(price.replace(/[,.\s]/g, ""))) return null; // price must have 3+ digit number

  return { grade, price };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function detectIncoterm(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes("CIF")) return "CIF";
  if (upper.includes("FOB")) return "FOB";
  if (upper.includes("CFR")) return "CFR";
  if (upper.includes("DDP")) return "DDP";
  return "CFR";
}

function detectPort(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes("CALLAO") || upper.includes("PECLL")) return "CALLAO";
  if (upper.includes("LIMA")) return "CALLAO";
  if (upper.includes("BUENAVENTURA")) return "BUENAVENTURA";
  return "CALLAO";
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
