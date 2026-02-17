/**
 * Quotation message templates for WhatsApp and Email.
 */

export interface QuotationData {
  salutation: string;
  contactName: string;
  familyDisplayName: string;
  uso: string;
  gradeCode: string;
  brand: string;
  manufacturer: string;
  attributes: string;
  meltIndexLabel: string;
  priceUsd: number;
  incoterm: string;
  port: string;
  paymentTerms: string;
  shipmentEstimate: string;
  senderName: string;
  companyName: string;
}

/**
 * Generate WhatsApp plain text message (for non-template fallback or preview).
 */
export function buildWhatsAppMessage(data: QuotationData): string {
  const price = data.priceUsd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `Hola ${data.contactName},

Tenemos disponible para usted:

*${data.familyDisplayName}* (${data.uso || "General"})
Grado: *${data.gradeCode}* - ${data.brand} (${data.manufacturer})
${data.attributes ? `Caracteristicas: ${data.attributes}\n` : ""}${data.meltIndexLabel ? `Melt Index: ${data.meltIndexLabel}\n` : ""}
Precio: *USD ${price}/TM* ${data.incoterm} ${data.port}

Condiciones:
- Pago: ${data.paymentTerms}
- Embarque estimado: ${data.shipmentEstimate}

Para consultas o confirmar pedido, responda a este mensaje.

_Cotizacion valida por 48 horas._`;
}

/**
 * Generate HTML email body for quotation.
 */
export function buildEmailHtml(data: QuotationData): string {
  const price = data.priceUsd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 0;">

  <div style="background: #1a365d; color: white; padding: 24px 32px;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">${escapeHtml(data.companyName)}</h1>
    <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Cotizacion de Resinas Plasticas</p>
  </div>

  <div style="background: white; padding: 32px;">
    <p style="color: #2d3748; font-size: 15px; margin: 0 0 16px;">
      ${escapeHtml(data.salutation)} ${escapeHtml(data.contactName)},
    </p>
    <p style="color: #4a5568; font-size: 14px; margin: 0 0 24px;">
      Le informamos que tenemos disponibilidad del siguiente material:
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;" cellpadding="0" cellspacing="0">
      <tr style="background: #f7fafc;">
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #2d3748; width: 35%;">Material</td>
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; color: #4a5568;">${escapeHtml(data.familyDisplayName)} (${escapeHtml(data.uso || "General")})</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #2d3748;">Grado</td>
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; color: #4a5568;">${escapeHtml(data.gradeCode)} - ${escapeHtml(data.brand)} (${escapeHtml(data.manufacturer)})</td>
      </tr>
      ${data.meltIndexLabel ? `<tr style="background: #f7fafc;">
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #2d3748;">Melt Index</td>
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; color: #4a5568;">${escapeHtml(data.meltIndexLabel)}</td>
      </tr>` : ""}
      ${data.attributes ? `<tr>
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #2d3748;">Caracteristicas</td>
        <td style="padding: 12px 16px; border: 1px solid #e2e8f0; color: #4a5568;">${escapeHtml(data.attributes)}</td>
      </tr>` : ""}
      <tr style="background: #ebf4ff;">
        <td style="padding: 14px 16px; border: 1px solid #e2e8f0; font-weight: 700; font-size: 16px; color: #2d3748;">Precio</td>
        <td style="padding: 14px 16px; border: 1px solid #e2e8f0; font-weight: 700; font-size: 16px; color: #2b6cb0;">USD ${price}/TM ${escapeHtml(data.incoterm)} ${escapeHtml(data.port)}</td>
      </tr>
    </table>

    <h3 style="color: #2d3748; font-size: 14px; margin: 0 0 12px;">Condiciones Comerciales</h3>
    <ul style="color: #4a5568; font-size: 14px; padding-left: 20px; margin: 0 0 24px;">
      <li style="margin-bottom: 6px;">Condicion de pago: ${escapeHtml(data.paymentTerms)}</li>
      <li style="margin-bottom: 6px;">Embarque estimado: ${escapeHtml(data.shipmentEstimate)}</li>
    </ul>

    <p style="color: #a0aec0; font-size: 12px; font-style: italic; margin: 0 0 24px;">
      Cotizacion valida por 48 horas. Precios sujetos a disponibilidad.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

    <p style="color: #4a5568; font-size: 14px; margin: 0 0 4px;">
      Quedamos atentos a sus comentarios.
    </p>
    <p style="color: #4a5568; font-size: 14px; margin: 0 0 16px;">Saludos cordiales,</p>
    <p style="color: #2d3748; font-size: 14px; font-weight: 600; margin: 0;">
      ${escapeHtml(data.senderName)}<br/>
      ${escapeHtml(data.companyName)}
    </p>
  </div>

</body>
</html>`;
}

/**
 * Generate email subject line.
 */
export function buildEmailSubject(data: {
  familyDisplayName: string;
  gradeCode: string;
  companyName: string;
}): string {
  return `Cotizacion ${data.familyDisplayName} ${data.gradeCode} - ${data.companyName}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
