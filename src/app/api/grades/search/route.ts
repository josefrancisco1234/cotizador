import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeGradeCode } from "@/lib/engine/grade-normalizer";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/grades/search?q=CL9010&family=HDPE&uso=Film
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q");
  const familyCode = searchParams.get("family");
  const uso = searchParams.get("uso");

  if (!query || query.length < 1) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const normalized = normalizeGradeCode(query);

  let dbQuery = supabase
    .from("product_grades")
    .select(`
      id, grade_code, uso, process, brand, manufacturer, attributes, melt_index_label,
      family:material_families!inner(code, display_name)
    `)
    .eq("tenant_id", TENANT_ID)
    .ilike("grade_code_normalized", `%${normalized}%`)
    .eq("is_active", true)
    .limit(20);

  if (uso) {
    dbQuery = dbQuery.ilike("uso", `%${uso}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by family code if specified (post-filter since family is a join)
  let results = data || [];
  if (familyCode) {
    results = results.filter((g) => {
      const fam = g.family as unknown as { code: string };
      return fam.code === familyCode.toUpperCase();
    });
  }

  return NextResponse.json({ data: results });
}
