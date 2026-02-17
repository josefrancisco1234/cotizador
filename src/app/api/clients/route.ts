import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/clients?status=active&zone=LIMA&q=dispercol
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const zone = searchParams.get("zone");
  const q = searchParams.get("q");

  let query = supabase
    .from("clients")
    .select(`
      id, client_code, business_name, ruc, zone, status, client_type,
      manufacturing_sectors, processes, final_products,
      preferences:client_material_preferences(
        id,
        family:material_families(code, display_name),
        uso, additives
      )
    `)
    .eq("tenant_id", TENANT_ID)
    .order("client_code");

  if (status) query = query.eq("status", status);
  if (zone) query = query.ilike("zone", `%${zone}%`);
  if (q) query = query.ilike("business_name", `%${q}%`);

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
