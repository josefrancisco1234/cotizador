import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/clients/[id] - Client detail with contacts and material preferences
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("clients")
    .select(`
      *,
      contacts:client_contacts(
        id, department, salutation, contact_name, full_name, channel, channel_value, priority, is_active
      ),
      preferences:client_material_preferences(
        id, uso, melt_index, additives, process, observations,
        family:material_families(code, display_name)
      )
    `)
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
