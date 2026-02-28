import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/** GET /api/grades-to-review — list pending unknown grades */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("grades_to_review")
    .select("id, grade_code, times_seen, last_seen_at, source, added_to_dict")
    .eq("tenant_id", TENANT_ID)
    .eq("added_to_dict", false)
    .order("times_seen", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

/** PATCH /api/grades-to-review?id=xxx — mark as added to dict */
export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("grades_to_review")
    .update({ added_to_dict: true })
    .eq("id", id)
    .eq("tenant_id", TENANT_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
