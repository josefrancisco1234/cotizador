/**
 * Run all SQL migrations against Supabase using the Management API.
 * Usage: npx tsx scripts/run-migrations.ts
 */

import fs from "fs";
import path from "path";

const SUPABASE_URL = "https://tirgwplsslitshwmgbel.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpcmd3cGxzc2xpdHNod21nYmVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM0NTQyNywiZXhwIjoyMDg2OTIxNDI3fQ.j8LRSgUGN_0faE2AM__bMtTWmWfS40aE89MxCCfHR90";

const migrationsDir = path.resolve(__dirname, "../supabase/migrations");

async function runSQL(sql: string, label: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({}),
  });
  // The RPC endpoint won't work for raw SQL. Use pg_net or direct connection instead.
  // Let's use the Supabase SQL endpoint (available via supabase-js)
  return true;
}

async function main() {
  // Use supabase-js to execute raw SQL via rpc
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql") && !f.includes("seed"))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  // Read all SQL and combine
  let allSQL = "";
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    allSQL += `-- ${file}\n${sql}\n\n`;
    console.log(`  Loaded: ${file}`);
  }

  console.log("\nExecuting migrations via Supabase SQL...\n");

  // Execute via the SQL query endpoint (using fetch to the pg endpoint)
  const response = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: allSQL }),
  });

  if (!response.ok) {
    // Try alternative: split by statement and use individual queries
    console.log("Direct SQL endpoint not available, trying statement-by-statement...\n");

    // Split SQL into individual statements
    const statements = allSQL
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));

    let success = 0;
    let failed = 0;

    for (const stmt of statements) {
      const fullStmt = stmt.endsWith(";") ? stmt : stmt + ";";
      const { error } = await supabase.rpc("exec_sql", { sql: fullStmt });

      if (error) {
        // Try via raw post to the query endpoint
        console.log(`  ⚠ Statement skipped (will try in SQL Editor): ${stmt.substring(0, 60)}...`);
        failed++;
      } else {
        success++;
      }
    }

    console.log(`\nResults: ${success} succeeded, ${failed} need manual execution`);

    if (failed > 0) {
      console.log("\n⚠ Some statements need to be run in the Supabase SQL Editor.");
      console.log("Copy the contents of /tmp/all_migrations.sql and paste in:");
      console.log("https://supabase.com/dashboard/project/tirgwplsslitshwmgbel/sql/new");
    }
  } else {
    console.log("✓ All migrations executed successfully!");
  }
}

main().catch(console.error);
