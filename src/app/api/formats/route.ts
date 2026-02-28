import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/** GET /api/formats — list all saved format examples */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("parsing_examples")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

/** POST /api/formats — save a new format example */
export async function POST(request: NextRequest) {
  const { supplierName, rawText, verifiedRows, notes } = await request.json();

  if (!rawText?.trim()) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("parsing_examples")
    .insert({
      tenant_id: TENANT_ID,
      supplier_name: supplierName || "",
      raw_text: rawText,
      verified_rows: verifiedRows || [],
      notes: notes || "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** DELETE /api/formats?id=xxx — delete an example */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("parsing_examples")
    .delete()
    .eq("id", id)
    .eq("tenant_id", TENANT_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
