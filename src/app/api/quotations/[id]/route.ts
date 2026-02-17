import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/quotations/[id] - Get quotation detail with items and recipients
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: quotation, error: qErr } = await supabase
    .from("quotations")
    .select(`
      *,
      items:quotation_items(
        id, price_usd, custom_notes,
        grade:product_grades(grade_code, uso, brand, manufacturer, attributes,
          family:material_families(code, display_name)
        )
      ),
      recipients:quotation_recipients(
        id, channel, dispatch_status, dispatched_at, error_message, retry_count,
        client:clients(client_code, business_name),
        contact:client_contacts(contact_name, channel_value)
      )
    `)
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (qErr || !quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  return NextResponse.json({ data: quotation });
}
