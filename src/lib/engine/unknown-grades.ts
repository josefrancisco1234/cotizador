/**
 * Persist unknown grade codes (found in emails but not in product_grades)
 * to the grades_to_review table so the admin can review them periodically
 * and add them to BD0_DICCIONARIO.
 */

import { SupabaseClient } from "@supabase/supabase-js";

const norm = (s: string) => s.toUpperCase().replace(/[\s\-\.]/g, "");

export async function saveUnknownGrades(
  supabase: SupabaseClient,
  tenantId: string,
  gradeCodes: string[],
  source: "ingestion" | "parse-preview",
): Promise<void> {
  if (gradeCodes.length === 0) return;

  const rows = gradeCodes.map((gc) => ({
    tenant_id: tenantId,
    grade_code: gc,
    grade_code_normalized: norm(gc),
    source,
    last_seen_at: new Date().toISOString(),
  }));

  // Upsert: if already exists, bump last_seen_at and increment times_seen
  const { error } = await supabase.from("grades_to_review").upsert(rows, {
    onConflict: "tenant_id,grade_code_normalized",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("grades_to_review upsert error:", error.message);
  }
}

/**
 * Given a list of extracted grade codes and the set of known grade codes,
 * returns the ones that are NOT in the dictionary.
 */
export function findUnknownGrades(
  extractedGrades: string[][],   // expandedGrades from each ParsedPriceRow
  knownGradeCodes: string[],
): string[] {
  const knownSet = new Set(knownGradeCodes.map(norm));
  const unknown: string[] = [];

  for (const grades of extractedGrades) {
    for (const g of grades) {
      if (!knownSet.has(norm(g))) {
        unknown.push(g);
      }
    }
  }

  return [...new Set(unknown)]; // deduplicate
}
