/**
 * Email dispatch via Resend.
 */

import { Resend } from "resend";

export interface EmailSendResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

export async function sendQuotationEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<EmailSendResult> {
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: htmlBody,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, emailId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
