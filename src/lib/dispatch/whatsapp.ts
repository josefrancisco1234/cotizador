/**
 * WhatsApp Cloud API client for sending template messages.
 */

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Normalize Peru phone numbers.
 * "990 360 057" -> "51990360057"
 */
export function normalizePhoneForWhatsApp(raw: string): string {
  const cleaned = raw.replace(/[\s\-\(\)\+]/g, "");

  // Already has country code
  if (cleaned.startsWith("51") && cleaned.length === 11) {
    return cleaned;
  }

  // Peru mobile: starts with 9, 9 digits
  if (cleaned.startsWith("9") && cleaned.length === 9) {
    return "51" + cleaned;
  }

  return cleaned;
}

/**
 * Send a WhatsApp template message.
 */
export async function sendWhatsAppTemplate(
  config: WhatsAppConfig,
  to: string,
  templateName: string,
  parameters: string[],
): Promise<WhatsAppSendResult> {
  const phone = normalizePhoneForWhatsApp(to);

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "es" },
            components: [
              {
                type: "body",
                parameters: parameters.map((p) => ({ type: "text", text: p })),
              },
            ],
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Build quotation template parameters for WhatsApp.
 */
export function buildWhatsAppQuotationParams(data: {
  contactName: string;
  familyDisplayName: string;
  uso: string;
  gradeCode: string;
  attributes: string;
  priceUsd: number;
  incoterm: string;
  port: string;
  paymentTerms: string;
  shipmentEstimate: string;
}): string[] {
  return [
    data.contactName,
    data.familyDisplayName,
    data.uso || "General",
    data.gradeCode,
    data.attributes || "",
    data.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2 }),
    `${data.incoterm} ${data.port}`,
    data.paymentTerms,
    data.shipmentEstimate,
  ];
}
