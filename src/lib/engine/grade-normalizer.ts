/**
 * Grade code normalization and expansion utilities.
 *
 * Handles patterns like:
 * - "JM-350 / 360 / 375" -> ["JM-350", "JM-360", "JM-375"]
 * - "HD6070EA / HD6070FA" -> ["HD6070EA", "HD6070FA"]
 * - "1020F" -> ["1020F"]
 */

export function normalizeGradeCode(code: string): string {
  return code.toUpperCase().replace(/[\s\-]/g, "").trim();
}

export function expandGrades(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Split by / or , separators
  const parts = trimmed.split(/[\/,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) return [parts[0]];

  const firstPart = parts[0];

  // Detect prefix: letters (and optional hyphen) at the start of first part
  const prefixMatch = firstPart.match(/^([A-Za-z]+[\-]?)/);
  if (!prefixMatch) return parts;

  const prefix = prefixMatch[1];

  return parts.map((part, i) => {
    if (i === 0) return part;
    // If this part is purely numeric (with optional letter suffix),
    // it likely needs the prefix from the first part
    if (/^\d+[A-Za-z]?$/.test(part)) {
      return prefix + part;
    }
    // Already has its own prefix
    return part;
  });
}

export function normalizePrice(raw: string): number | null {
  if (!raw || typeof raw !== "string") return null;

  // Remove currency symbols, "USD", "US$", etc.
  let cleaned = raw.replace(/USD|US\$|U\.S\./gi, "").trim();

  // Remove non-numeric except dots and commas
  cleaned = cleaned.replace(/[^\d.,]/g, "");

  if (!cleaned) return null;

  // Peru convention: comma = thousands separator, dot = decimal
  // Detect if last separator is comma or dot
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > lastDot) {
    // Comma is after dot -> comma is thousands separator (1.000,50 format)
    // But in our Peru context, prices are typically whole numbers like "1,045"
    // meaning 1045 (thousands separator), not 1.045
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // Standard: remove commas as thousands separators
    cleaned = cleaned.replace(/,/g, "");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
