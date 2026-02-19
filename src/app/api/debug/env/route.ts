import { NextResponse } from "next/server";

/** GET /api/debug/env — returns which env vars are present (no values) */
export async function GET() {
  return NextResponse.json({
    GMAIL_CLIENT_ID: !!process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: !!process.env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: !!process.env.GMAIL_REFRESH_TOKEN,
    GMAIL_FROM_EMAIL: !!process.env.GMAIL_FROM_EMAIL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    DEFAULT_TENANT_ID: !!process.env.DEFAULT_TENANT_ID,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    CRON_SECRET: !!process.env.CRON_SECRET,
  });
}
