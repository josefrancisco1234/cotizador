import { gmail } from "./client";

interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  fromName?: string;
}

/**
 * Send an email via Gmail API.
 */
export async function sendEmailViaGmail({
  to,
  subject,
  htmlBody,
  fromName = "Cotizador B2B",
}: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const fromEmail = process.env.GMAIL_FROM_EMAIL || "mc.maricarmenfernandez@gmail.com";

    const raw = createRawEmail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      htmlBody,
    });

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return { success: true, messageId: res.data.id || undefined };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Save an email as a Gmail draft (does NOT send it).
 */
export async function saveDraftViaGmail({
  to,
  subject,
  htmlBody,
  fromName = "Cotizador B2B",
}: SendEmailParams): Promise<{ success: boolean; draftId?: string; error?: string }> {
  try {
    const fromEmail = process.env.GMAIL_FROM_EMAIL || "mc.maricarmenfernandez@gmail.com";

    const raw = createRawEmail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      htmlBody,
    });

    const res = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw } },
    });

    return { success: true, draftId: res.data.id || undefined };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

function createRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
}): string {
  const boundary = "boundary_" + Date.now();
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.htmlBody).toString("base64"),
    `--${boundary}--`,
  ];

  return Buffer.from(lines.join("\r\n"))
    .toString("base64url");
}
