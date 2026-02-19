/**
 * Shared quotation email builder.
 * Generates HTML for a multi-item quotation email with dynamic dates.
 */

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Returns "19 de febrero de 2026" */
export function todayLong(): string {
  const d = new Date();
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Returns "Marzo 2026" (always 1 month from today) */
export function shipmentMonth(): string {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const name = MONTHS_ES[next.getMonth()];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${next.getFullYear()}`;
}

/** Builds the greeting line: "Estimada Señorita," / "Estimada Vilma," */
export function buildGreeting(salutation: string | null, contactName: string | null): string {
  const sal = (salutation || "Estimado/a").trim();
  const name = (contactName || "").trim();
  // Avoid duplicating if name is already inside salutation
  if (!name || sal.toLowerCase().includes(name.toLowerCase())) {
    return sal;
  }
  return `${sal} ${name}`;
}

export interface QuotationEmailItem {
  price_usd: number;
  grade: {
    grade_code: string;
    uso: string | null;
    brand: string | null;
    manufacturer: string | null;
    attributes: string | null;
    melt_index_label: string | null;
    family: { display_name: string };
  };
}

export interface QuotationEmailParams {
  salutation: string | null;
  contactName: string | null;
  items: QuotationEmailItem[];
  paymentTerms: string;
  senderName: string;
  companyName: string;
}

export function buildQuotationEmailHtml(data: QuotationEmailParams): string {
  const today = todayLong();
  const shipment = shipmentMonth();
  const greeting = buildGreeting(data.salutation, data.contactName);

  const rows = data.items
    .map((item) => {
      const price = item.price_usd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const extras = [
        item.grade.uso ? `<span style="color:#718096;">${esc(item.grade.uso)}</span>` : "",
        item.grade.attributes ? `<span style="color:#718096;">${esc(item.grade.attributes)}</span>` : "",
        item.grade.melt_index_label ? `<span style="color:#718096;">MI: ${esc(item.grade.melt_index_label)}</span>` : "",
      ]
        .filter(Boolean)
        .join("<br/>");

      return `
      <tr>
        <td style="padding:12px 16px;border:1px solid #e2e8f0;color:#2d3748;font-weight:600;vertical-align:top;">
          ${esc(item.grade.family.display_name)}
        </td>
        <td style="padding:12px 16px;border:1px solid #e2e8f0;color:#4a5568;vertical-align:top;font-size:13px;">
          <strong>${esc(item.grade.grade_code)}</strong>
          ${item.grade.brand ? ` — ${esc(item.grade.brand)}` : ""}
          ${item.grade.manufacturer ? ` <span style="color:#a0aec0;">(${esc(item.grade.manufacturer)})</span>` : ""}
          ${extras ? `<br/>${extras}` : ""}
        </td>
        <td style="padding:12px 16px;border:1px solid #e2e8f0;color:#2b6cb0;font-weight:700;font-size:15px;text-align:right;white-space:nowrap;vertical-align:top;">
          USD ${price}/TM<br/><span style="font-size:11px;font-weight:400;color:#718096;">CFR Callao</span>
        </td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;padding:0;">

  <div style="background:#1a365d;color:white;padding:24px 32px;">
    <h1 style="margin:0;font-size:20px;font-weight:600;">${esc(data.companyName)}</h1>
    <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">Cotizacion de Resinas Plasticas &nbsp;·&nbsp; ${esc(today)}</p>
  </div>

  <div style="background:white;padding:32px;">
    <p style="color:#2d3748;font-size:15px;margin:0 0 8px;">
      ${esc(greeting)},
    </p>
    <p style="color:#4a5568;font-size:14px;margin:0 0 24px;">
      Le informamos que tenemos disponibilidad de los siguientes materiales:
    </p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f7fafc;">
          <th style="padding:10px 16px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#4a5568;font-weight:600;">Material</th>
          <th style="padding:10px 16px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#4a5568;font-weight:600;">Grado / Caracteristicas</th>
          <th style="padding:10px 16px;border:1px solid #e2e8f0;text-align:right;font-size:12px;color:#4a5568;font-weight:600;">Precio</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <h3 style="color:#2d3748;font-size:14px;margin:0 0 10px;">Condiciones Comerciales</h3>
    <ul style="color:#4a5568;font-size:14px;padding-left:20px;margin:0 0 24px;">
      <li style="margin-bottom:6px;">Condicion de pago: ${esc(data.paymentTerms)}</li>
      <li style="margin-bottom:6px;">Embarque estimado: <strong>${esc(shipment)}</strong></li>
    </ul>

    <p style="color:#a0aec0;font-size:12px;font-style:italic;margin:0 0 24px;">
      Cotizacion valida al <strong>${esc(today)}</strong>. Precios sujetos a disponibilidad.
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

    <p style="color:#4a5568;font-size:14px;margin:0 0 4px;">Quedamos atentos a sus consultas.</p>
    <p style="color:#4a5568;font-size:14px;margin:0 0 16px;">Saludos cordiales,</p>
    <p style="color:#2d3748;font-size:14px;font-weight:600;margin:0;">
      ${esc(data.senderName)}<br/>
      <span style="font-weight:400;color:#4a5568;">${esc(data.companyName)}</span>
    </p>
  </div>

</body>
</html>`;
}

export function buildQuotationEmailSubject(items: QuotationEmailItem[], companyName: string): string {
  const families = [...new Set(items.map((i) => i.grade.family.display_name))].join(" / ");
  const grades = items.map((i) => i.grade.grade_code).join(", ");
  return `Cotizacion ${families} ${grades} - ${companyName}`;
}

function esc(s: string | null | undefined): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
