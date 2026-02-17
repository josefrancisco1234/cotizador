import { gmail } from "./client";
import { createAdminClient } from "../supabase/admin";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

interface ProcessedEmail {
  messageId: string;
  from: string;
  subject: string;
  htmlBody: string;
  supplierId: string | null;
}

/**
 * Check Gmail inbox for new price emails from known suppliers.
 * Returns list of processed emails.
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

  // Get known supplier email patterns
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, email_patterns")
    .eq("tenant_id", TENANT_ID);

  if (!suppliers || suppliers.length === 0) {
    return { processed: 0, skipped: 0, errors: ["No suppliers configured"] };
  }

  // Build Gmail search query: from any supplier, unread, last 24 hours
  const emailPatterns = suppliers.flatMap(
    (s: { email_patterns: string[] }) => s.email_patterns || []
  );

  if (emailPatterns.length === 0) {
    return { processed: 0, skipped: 0, errors: ["No supplier email patterns configured"] };
  }

  const fromQuery = emailPatterns.map((e: string) => `from:${e}`).join(" OR ");
  const query = `(${fromQuery}) is:unread newer_than:1d`;

  // Search for matching emails
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
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
        skipped++;
        continue;
      }

      // Extract HTML body
      const htmlBody = extractHtmlBody(email.data.payload);

      if (!htmlBody) {
        errors.push(`No HTML body found in email: ${subject}`);
        continue;
      }

      // Match supplier
      const supplier = suppliers.find((s: { email_patterns: string[] }) =>
        (s.email_patterns || []).some((pattern: string) =>
          from.toLowerCase().includes(pattern.toLowerCase())
        )
      );

      // Create ingestion record
      const { error: insertError } = await supabase
        .from("price_ingestions")
        .insert({
          tenant_id: TENANT_ID,
          supplier_id: supplier?.id || null,
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

      // Mark email as read
      await gmail.users.messages.modify({
        userId: "me",
        id: msg.id!,
        requestBody: { removeLabelIds: ["UNREAD"] },
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
