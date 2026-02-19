import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmailHtml, buildEmailSubject } from "@/lib/dispatch/templates";
import type { QuotationData } from "@/lib/dispatch/templates";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;
const COMPANY_NAME = "Petroquimica";
const SENDER_NAME = "Maricarmen Fernandez";
const DEFAULT_PAYMENT_TERMS = "CAD / 30 dias";
const DEFAULT_SHIPMENT = "4-6 semanas";

/**
 * GET /api/quotations/[id]/preview?recipientId=xxx
 * Returns rendered HTML email for a specific recipient (or first one if not specified).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const recipientId = request.nextUrl.searchParams.get("recipientId");

  // Load quotation items
  const { data: quotation, error: qErr } = await supabase
    .from("quotations")
    .select(`
      id, payment_terms, shipment_terms,
      items:quotation_items(
        price_usd,
        grade:product_grades!inner(
          grade_code, uso, brand, manufacturer, attributes, melt_index_label,
          family:material_families!inner(display_name)
        )
      )
    `)
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (qErr || !quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  // Load recipients
  let recipientQuery = supabase
    .from("quotation_recipients")
    .select(`
      id, channel,
      client:clients!inner(business_name, client_code),
      contact:client_contacts!inner(contact_name, salutation, channel_value)
    `)
    .eq("quotation_id", id)
    .eq("tenant_id", TENANT_ID)
    .eq("channel", "email");

  if (recipientId) {
    recipientQuery = recipientQuery.eq("id", recipientId);
  } else {
    recipientQuery = recipientQuery.limit(1);
  }

  const { data: recipients } = await recipientQuery;

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "No email recipients found" }, { status: 404 });
  }

  const recipient = recipients[0] as unknown as {
    id: string;
    channel: string;
    client: { business_name: string; client_code: string };
    contact: { contact_name: string; salutation: string; channel_value: string };
  };

  const items = (quotation as unknown as {
    payment_terms: string;
    shipment_terms: string;
    items: Array<{
      price_usd: number;
      grade: {
        grade_code: string;
        uso: string;
        brand: string;
        manufacturer: string;
        attributes: string;
        melt_index_label: string;
        family: { display_name: string };
      };
    }>;
  }).items;

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items in quotation" }, { status: 404 });
  }

  // Build multi-item email HTML
  const qData = quotation as unknown as { payment_terms: string; shipment_terms: string };
  const html = buildMultiItemEmailHtml({
    salutation: recipient.contact.salutation || "Estimado(a)",
    contactName: recipient.contact.contact_name || "Cliente",
    items,
    paymentTerms: qData.payment_terms || DEFAULT_PAYMENT_TERMS,
    shipmentEstimate: qData.shipment_terms || DEFAULT_SHIPMENT,
    senderName: SENDER_NAME,
    companyName: COMPANY_NAME,
  });

  const subject = buildEmailSubject({
    familyDisplayName: items.map((i) => i.grade.family.display_name).join(" / "),
    gradeCode: items.map((i) => i.grade.grade_code).join(", "),
    companyName: COMPANY_NAME,
  });

  return NextResponse.json({
    recipientId: recipient.id,
    to: recipient.contact.channel_value,
    contactName: recipient.contact.contact_name,
    clientName: recipient.client.business_name,
    subject,
    html,
  });
}

function buildMultiItemEmailHtml(data: {
  salutation: string;
  contactName: string;
  items: Array<{
    price_usd: number;
    grade: {
      grade_code: string;
      uso: string;
      brand: string;
      manufacturer: string;
      attributes: string;
      melt_index_label: string;
      family: { display_name: string };
    };
  }>;
  paymentTerms: string;
  shipmentEstimate: string;
  senderName: string;
  companyName: string;
}): string {
  const rows = data.items
    .map((item) => {
      const price = item.price_usd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `
      <tr>
        <td style="padding:12px 16px;border:1px solid #e2e8f0;color:#2d3748;font-weight:600;">
          ${esc(item.grade.family.display_name)}
        </td>
        <td style="padding:12px 16px;border:1px solid #e2e8f0;color:#4a5568;">
          ${esc(item.grade.grade_code)} — ${esc(item.grade.brand || "")} ${item.grade.manufacturer ? `(${esc(item.grade.manufacturer)})` : ""}
          ${item.grade.uso ? `<br/><span style="font-size:12px;color:#718096;">${esc(item.grade.uso)}</span>` : ""}
          ${item.grade.attributes ? `<br/><span style="font-size:12px;color:#718096;">${esc(item.grade.attributes)}</span>` : ""}
          ${item.grade.melt_index_label ? `<br/><span style="font-size:12px;color:#718096;">MI: ${esc(item.grade.melt_index_label)}</span>` : ""}
        </td>
        <td style="padding:12px 16px;border:1px solid #e2e8f0;color:#2b6cb0;font-weight:700;font-size:15px;text-align:right;white-space:nowrap;">
          USD ${price}/TM<br/><span style="font-size:11px;font-weight:400;color:#718096;">CFR Callao</span>
        </td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;padding:0;">

  <div style="background:#1a365d;color:white;padding:24px 32px;">
    <h1 style="margin:0;font-size:20px;font-weight:600;">${esc(data.companyName)}</h1>
    <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">Cotizacion de Resinas Plasticas</p>
  </div>

  <div style="background:white;padding:32px;">
    <p style="color:#2d3748;font-size:15px;margin:0 0 8px;">
      ${esc(data.salutation)} ${esc(data.contactName)},
    </p>
    <p style="color:#4a5568;font-size:14px;margin:0 0 24px;">
      Le informamos que tenemos disponibilidad de los siguientes materiales:
    </p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f7fafc;">
          <th style="padding:10px 16px;border:1px solid #e2e8f0;text-align:left;font-size:13px;color:#4a5568;">Material</th>
          <th style="padding:10px 16px;border:1px solid #e2e8f0;text-align:left;font-size:13px;color:#4a5568;">Grado / Caracteristicas</th>
          <th style="padding:10px 16px;border:1px solid #e2e8f0;text-align:right;font-size:13px;color:#4a5568;">Precio</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <h3 style="color:#2d3748;font-size:14px;margin:0 0 10px;">Condiciones Comerciales</h3>
    <ul style="color:#4a5568;font-size:14px;padding-left:20px;margin:0 0 24px;">
      <li style="margin-bottom:6px;">Condicion de pago: ${esc(data.paymentTerms)}</li>
      <li style="margin-bottom:6px;">Embarque estimado: ${esc(data.shipmentEstimate)}</li>
    </ul>

    <p style="color:#a0aec0;font-size:12px;font-style:italic;margin:0 0 24px;">
      Cotizacion valida por 48 horas. Precios sujetos a disponibilidad.
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

    <p style="color:#4a5568;font-size:14px;margin:0 0 4px;">Quedamos atentos a sus comentarios.</p>
    <p style="color:#4a5568;font-size:14px;margin:0 0 16px;">Saludos cordiales,</p>
    <p style="color:#2d3748;font-size:14px;font-weight:600;margin:0;">
      ${esc(data.senderName)}<br/>${esc(data.companyName)}
    </p>
  </div>

</body>
</html>`;
}

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
