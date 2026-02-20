import { NextRequest, NextResponse } from "next/server";
import { checkInboxForPriceEmails } from "@/lib/gmail/check-inbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmailHtml } from "@/lib/engine/email-parser";
import { runMatchingForIngestion } from "@/lib/engine/matching-engine";

const CRON_SECRET = process.env.CRON_SECRET;
const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

/**
 * GET /api/gmail/check - Check Gmail for new supplier emails, parse, and run matching.
 * Protected by CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  // Verify authorization - allow from internal dashboard (referer) or cron with secret
  const authHeader = request.headers.get("authorization");
  const referer = request.headers.get("referer") || "";
  const isInternalRequest = referer.includes("/ingestions");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isInternalRequest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: check Gmail credentials are configured
  if (!process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Gmail no configurado en Vercel. Ve a tu proyecto → Settings → Environment Variables y agrega GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_FROM_EMAIL. Luego redeploya." },
      { status: 500 }
    );
  }

  try {
    // Step 1: Check inbox and create ingestion records
    const checkResult = await checkInboxForPriceEmails();

    if (checkResult.processed === 0) {
      return NextResponse.json({
        message: "No new emails to process",
        ...checkResult,
      });
    }

    // Step 2: Parse and match pending ingestions
    const supabase = createAdminClient();
    const { data: pendingIngestions } = await supabase
      .from("price_ingestions")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    let matched = 0;
    const matchErrors: string[] = [];

    for (const ingestion of pendingIngestions || []) {
      try {
        // Parse HTML if not already parsed
        if (!ingestion.parsed_data && ingestion.raw_html) {
          const parseResult = parseEmailHtml(ingestion.raw_html);

          // Create price entries
          const priceEntries = [];
          for (const row of parseResult.rows) {
            for (const gradeCode of row.expandedGrades) {
              priceEntries.push({
                tenant_id: TENANT_ID,
                ingestion_id: ingestion.id,
                raw_grade_text: gradeCode,
                raw_price_text: row.rawPriceText,
                price_usd: row.priceUsd,
                incoterm: row.incoterm,
                port: row.port,
              });
            }
          }

          if (priceEntries.length > 0) {
            await supabase.from("price_entries").insert(priceEntries);
          }

          await supabase
            .from("price_ingestions")
            .update({
              parsed_data: parseResult,
              grades_found: priceEntries.length,
              status: priceEntries.length > 0 ? "processing" : "failed",
            })
            .eq("id", ingestion.id);
        }

        // Run matching engine
        const matchResult = await runMatchingForIngestion(ingestion.id, TENANT_ID);

        await supabase
          .from("price_ingestions")
          .update({
            status: "completed",
            grades_matched: matchResult.matched,
            grades_unknown: matchResult.unknown,
            processed_at: new Date().toISOString(),
          })
          .eq("id", ingestion.id);

        matched++;
      } catch (err) {
        matchErrors.push(`Ingestion ${ingestion.id}: ${(err as Error).message}`);

        await supabase
          .from("price_ingestions")
          .update({ status: "failed", error_message: (err as Error).message })
          .eq("id", ingestion.id);
      }
    }

    return NextResponse.json({
      message: "Email check complete",
      emails: checkResult,
      matching: { processed: matched, errors: matchErrors },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
