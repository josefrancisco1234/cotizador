import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWhatsAppMessage } from "@/lib/engine/whatsapp-ingestion";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * POST /api/ingestions/whatsapp
 * Manual WhatsApp message paste — NO LLM, zero token cost.
 * Body: { text: string, from?: string }
 */
export async function POST(request: NextRequest) {
  const { text, from } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Generate a stable messageId from content + timestamp for idempotency
  const messageId = `manual-wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const result = await processWhatsAppMessage(supabase, TENANT_ID, {
    messageId,
    from: from?.trim() || "manual-paste",
    body: text.trim(),
  });

  if (result.skipped) {
    return NextResponse.json({
      skipped: true,
      message: "No se detectaron grados ni precios conocidos en el mensaje.",
    });
  }

  return NextResponse.json({
    ingestionId: result.ingestionId,
    gradesFound: result.gradesFound,
    message: `${result.gradesFound} grado(s) encontrado(s) y guardado(s).`,
  }, { status: 201 });
}
