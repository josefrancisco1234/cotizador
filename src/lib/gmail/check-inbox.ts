import { gmail } from "./client";
import { createAdminClient } from "../supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;
const LABEL_NAME = "COTIZAR";

/**
 * Check Gmail inbox for emails with the "COTIZAR" label.
 * Process them and remove the label after processing.
 */
export async function checkInboxForPriceEmails(): Promise<{
  processed: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let processed = 0;
  let skipped = 0;

  // Find the "COTIZAR" label ID
  const labelsRes = await gmail.users.labels.list({ userId: "me" });
  const cotizarLabel = (labelsRes.data.labels || []).find(
    (l) => l.name === LABEL_NAME
  );

  if (!cotizarLabel || !cotizarLabel.id) {
    return { processed: 0, skipped: 0, errors: [`Label "${LABEL_NAME}" not found in Gmail`] };
  }

  const labelId = cotizarLabel.id;

  // Search for emails with the "COTIZAR" label
  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: [labelId],
    maxResults: 20,
  });

  const messages = listRes.data.messages || [];

  if (messages.length === 0) {
    return { processed: 0, skipped: 0, errors: [] };
  }

  for (const msg of messages) {
    try {
      // Get full email
      const email = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = email.data.payload?.headers || [];
      const messageId = headers.find((h) => h.name === "Message-ID")?.value || msg.id!;
      const from = headers.find((h) => h.name === "From")?.value || "";
      const subject = headers.find((h) => h.name === "Subject")?.value || "";

      // Check if already processed (idempotency)
      const { data: existing } = await supabase
        .from("price_ingestions")
        .select("id")
        .eq("tenant_id", TENANT_ID)
        .eq("source_identifier", messageId)
        .maybeSingle();

      if (existing) {
        // Already processed, just remove the label
        await gmail.users.messages.modify({
          userId: "me",
          id: msg.id!,
          requestBody: { removeLabelIds: [labelId] },
        });
        skipped++;
        continue;
      }

      // Extract HTML body
      const htmlBody = extractHtmlBody(email.data.payload);

      if (!htmlBody) {
        errors.push(`No HTML body found in email: ${subject}`);
        // Remove label so it doesn't retry
        await gmail.users.messages.modify({
          userId: "me",
          id: msg.id!,
          requestBody: { removeLabelIds: [labelId] },
        });
        continue;
      }

      // Create ingestion record
      const { error: insertError } = await supabase
        .from("price_ingestions")
        .insert({
          tenant_id: TENANT_ID,
          source_type: "email",
          source_identifier: messageId,
          source_subject: subject,
          source_from: from,
          raw_html: htmlBody,
          status: "pending",
        });

      if (insertError) {
        errors.push(`Failed to save ingestion for "${subject}": ${insertError.message}`);
        continue;
      }

      // Remove "COTIZAR" label after successful processing
      await gmail.users.messages.modify({
        userId: "me",
        id: msg.id!,
        requestBody: { removeLabelIds: [labelId] },
      });

      processed++;
    } catch (err) {
      errors.push(`Error processing message ${msg.id}: ${(err as Error).message}`);
    }
  }

  return { processed, skipped, errors };
}

/**
 * Recursively extract HTML body from Gmail message payload.
 */
function extractHtmlBody(payload: any): string | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!payload) return null;

  // Direct HTML part
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Multipart: search parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }

  return null;
}
