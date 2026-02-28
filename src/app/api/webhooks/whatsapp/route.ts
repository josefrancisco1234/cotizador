import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWhatsAppMessage } from "@/lib/engine/whatsapp-ingestion";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/webhooks/whatsapp - Webhook verification (Meta handshake)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp - Receive delivery status updates
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  // Process status updates from WhatsApp
  const entries = body?.entry || [];

  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value || {};

      // ── Inbound messages from suppliers ───────────────────────────────────
      const messages = value.messages || [];
      for (const message of messages) {
        if (message.type !== "text") continue; // only handle text messages
        const body = message.text?.body;
        if (!body?.trim()) continue;

        try {
          await processWhatsAppMessage(supabase, TENANT_ID, {
            messageId: message.id,
            from: message.from,
            body,
            timestamp: message.timestamp,
          });
        } catch (err) {
          console.error("WhatsApp inbound parse error:", (err as Error).message);
        }
      }

      // ── Outbound delivery status updates ──────────────────────────────────
      const statuses = value.statuses || [];
      for (const status of statuses) {
        const messageId = status.id;
        const statusValue = status.status; // sent, delivered, read, failed

        if (!messageId) continue;

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        switch (statusValue) {
          case "sent":
            updateData.dispatch_status = "sent";
            updateData.dispatched_at = new Date().toISOString();
            break;
          case "delivered":
            updateData.dispatch_status = "delivered";
            updateData.delivered_at = new Date().toISOString();
            break;
          case "read":
            updateData.dispatch_status = "read";
            updateData.read_at = new Date().toISOString();
            break;
          case "failed":
            updateData.dispatch_status = "failed";
            updateData.error_message = status.errors?.[0]?.message || "WhatsApp delivery failed";
            break;
          default:
            continue;
        }

        await supabase
          .from("quotation_recipients")
          .update(updateData)
          .eq("external_message_id", messageId);
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}
