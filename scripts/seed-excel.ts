/**
 * Excel Import Script
 *
 * Reads BD_CLIENTES_MASTER-1502.xlsx and seeds Supabase with:
 * - material_families (from constants)
 * - product_grades (from BD0_DICCIONARIO)
 * - clients + client_contacts (from BD1_CLIENTES)
 * - client_material_preferences (from BD2_CLIENTE_MP_REDUCIDA)
 *
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-excel.ts
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// ─── Config ─────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, "../../BD_CLIENTES_MASTER-1502.xlsx");
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Material Families ──────────────────────────────────
const FAMILIES = [
  { code: "HDPE", display_name: "Polietileno Alta Densidad", aliases: ["Alta", "ALTA", "alta", "HDPE", "HD", "hdpe"] },
  { code: "LDPE", display_name: "Polietileno Baja Densidad", aliases: ["Baja", "BAJA", "baja", "LDPE", "LD", "ldpe"] },
  { code: "LLDPE", display_name: "Polietileno Lineal", aliases: ["Lineal", "LINEAL", "lineal", "LLDPE", "LLD", "lldpe"] },
  { code: "PP", display_name: "Polipropileno", aliases: ["PP", "pp"] },
  { code: "ABS", display_name: "ABS", aliases: ["ABS", "abs"] },
  { code: "PET", display_name: "PET", aliases: ["PET", "pet"] },
  { code: "GPPS", display_name: "Poliestireno Cristal", aliases: ["GPPS", "gpps", "PS Cristal"] },
  { code: "HIPS", display_name: "Poliestireno Alto Impacto", aliases: ["HIPS", "hips", "PS Alto Impacto"] },
  { code: "EPS", display_name: "Poliestireno Expandible", aliases: ["EPS", "eps"] },
  { code: "EVA", display_name: "Etileno Vinil Acetato", aliases: ["EVA", "eva"] },
  { code: "PC", display_name: "Policarbonato", aliases: ["PC", "pc"] },
  { code: "PVC", display_name: "PVC", aliases: ["PVC", "pvc"] },
  { code: "PA6", display_name: "Poliamida 6", aliases: ["PA6", "pa6", "Nylon", "nylon"] },
  { code: "SAN", display_name: "SAN", aliases: ["SAN", "san"] },
  { code: "PLA", display_name: "Acido Polilactico", aliases: ["PLA", "pla"] },
  { code: "CaCO3", display_name: "Carbonato de Calcio", aliases: ["CaCO3", "caco3", "CACO3"] },
  { code: "POM", display_name: "Poliacetal", aliases: ["POM", "pom", "Acetal"] },
  { code: "PMMA", display_name: "Polimetilmetacrilato", aliases: ["PMMA", "pmma", "Acrilico"] },
];

// ─── Helpers ────────────────────────────────────────────
function normalizeGradeCode(code: string | number): string {
  return String(code).toUpperCase().replace(/[\s\-]/g, "").trim();
}

function extractEmail(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].toLowerCase() : null;
}

function normalizePhone(raw: string | number | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[\s\-\(\)]/g, "").trim();
  if (cleaned.length < 6) return null;
  // Add Peru country code if not present
  if (cleaned.startsWith("9") && cleaned.length === 9) {
    return "51" + cleaned;
  }
  if (cleaned.startsWith("51") && cleaned.length === 11) {
    return cleaned;
  }
  return cleaned;
}

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/\u00a0/g, " ").trim();
  return s.length > 0 ? s : null;
}

const STATUS_MAP: Record<string, string> = {
  Activo: "active", activo: "active",
  Prospecto: "prospect", prospecto: "prospect",
  Inactivo: "inactive", inactivo: "inactive",
};

const TYPE_MAP: Record<string, string> = {
  Transformador: "transformer", transformador: "transformer",
  Distribuidor: "distributor", distribuidor: "distributor",
};

// ─── Main ───────────────────────────────────────────────
async function main() {
  console.log("Reading Excel:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);

  // 1. Create or get tenant
  console.log("\n1. Creating tenant...");
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .upsert({ name: "Petroquimica", slug: "petroquimica" }, { onConflict: "slug" })
    .select()
    .single();

  if (tenantErr) throw new Error(`Tenant error: ${tenantErr.message}`);
  const tenantId = tenant.id;
  console.log("   Tenant ID:", tenantId);

  // 2. Seed material families
  console.log("\n2. Seeding material families...");
  const familyRows = FAMILIES.map((f) => ({ ...f, tenant_id: tenantId }));
  const { error: famErr } = await supabase
    .from("material_families")
    .upsert(familyRows, { onConflict: "tenant_id,code" });
  if (famErr) throw new Error(`Families error: ${famErr.message}`);

  // Fetch families for ID mapping
  const { data: families } = await supabase
    .from("material_families")
    .select("id, code, aliases")
    .eq("tenant_id", tenantId);

  const familyMap = new Map<string, string>(); // alias -> family_id
  for (const fam of families || []) {
    for (const alias of fam.aliases) {
      familyMap.set(alias, fam.id);
      familyMap.set(alias.toLowerCase(), fam.id);
    }
  }
  console.log(`   ${families?.length} families seeded`);

  // 3. Import product grades (BD0_DICCIONARIO)
  console.log("\n3. Importing product grades (BD0_DICCIONARIO)...");
  const dictSheet = wb.Sheets["BD0_DICCIONARIO"];
  const dictRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(dictSheet);

  const gradeInserts: Record<string, unknown>[] = [];
  let skippedGrades = 0;

  for (const row of dictRows) {
    const familiaRaw = str(row["FAMILIA"]);
    const gradeRaw = row["Grado"];
    if (!gradeRaw) continue;

    const familyId = familiaRaw ? (familyMap.get(familiaRaw) || familyMap.get(familiaRaw.toLowerCase())) : null;
    if (!familyId) {
      skippedGrades++;
      continue;
    }

    const gradeCode = String(gradeRaw);
    gradeInserts.push({
      tenant_id: tenantId,
      family_id: familyId,
      grade_code: gradeCode,
      grade_code_normalized: normalizeGradeCode(gradeCode),
      brand: str(row["Marca"]),
      manufacturer: str(row["FABRICANTE"]),
      uso: str(row["USO"]),
      subtipo_uso: str(row["Subtipo/Uso"]),
      melt_index: row["MI"] != null ? Number(row["MI"]) || null : null,
      melt_index_label: str(row["melt index"]),
      additives: str(row["ADD"]),
      attributes: str(row["ATRIBUTOS"]),
      process: str(row["Proceso"]),
    });
  }

  // Deduplicate by grade_code_normalized (keep last occurrence)
  const gradeMap = new Map<string, Record<string, unknown>>();
  for (const g of gradeInserts) {
    gradeMap.set(g.grade_code_normalized as string, g);
  }
  const dedupedGrades = Array.from(gradeMap.values());
  console.log(`   ${gradeInserts.length} rows → ${dedupedGrades.length} unique grades after dedup`);

  // Batch upsert in chunks of 100 (already deduplicated so no intra-batch conflicts)
  let inserted = 0;
  for (let i = 0; i < dedupedGrades.length; i += 100) {
    const chunk = dedupedGrades.slice(i, i + 100);
    const { error } = await supabase
      .from("product_grades")
      .upsert(chunk, { onConflict: "tenant_id,grade_code_normalized" });
    if (error) {
      console.error(`   Grade upsert error at batch ${i}:`, error.message);
    } else {
      inserted += chunk.length;
    }
  }
  console.log(`   ${inserted}/${dedupedGrades.length} grades imported, ${skippedGrades} skipped (unknown family)`);

  // 4. Import clients (BD1_CLIENTES)
  console.log("\n4. Importing clients (BD1_CLIENTES)...");
  const clientSheet = wb.Sheets["BD1_CLIENTES"];
  const clientRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(clientSheet);

  const clientInserts: Record<string, unknown>[] = [];
  const contactInserts: Record<string, unknown>[] = [];

  for (const row of clientRows) {
    const code = str(row["codigo cliente"]);
    const name = str(row["Razón Social"] || row["Razon Social"]);
    if (!code || !name) continue;

    const statusRaw = str(row["Estado del Cliente"]) || "Activo";
    const typeRaw = str(row["TIPO DE CLIENTE"]);

    clientInserts.push({
      tenant_id: tenantId,
      client_code: code,
      business_name: name.trim(),
      ruc: str(row["RUC"]) ? String(row["RUC"]) : null,
      zone: str(row["Zona"]),
      status: STATUS_MAP[statusRaw] || "active",
      client_type: typeRaw ? (TYPE_MAP[typeRaw] || null) : null,
      manufacturing_sectors: [
        str(row["Rubro de Fabricación 1"] || row["Rubro de Fabricacion 1"]),
        str(row["Rubro de Fabricación 2"] || row["Rubro de Fabricacion 2"]),
        str(row["Rubro de Fabricación 3"] || row["Rubro de Fabricacion 3"]),
      ].filter(Boolean),
      processes: [
        str(row["Procesos que Tiene 1"]),
        str(row["Procesos que Tiene 2"]),
        str(row["Procesos que Tiene 3"]),
      ].filter(Boolean),
      final_products: [
        str(row["Producto Final Principal"]),
      ].filter(Boolean),
      grades_infogestion: str(row["GRADOS INFOGESTION"]),
    });

    // Extract contacts - Purchasing department
    const salutionCompras = str(row["Saludo Compras"]);
    for (let i = 1; i <= 3; i++) {
      const namePart1 = str(row[`Contactos  Compras ${i}`] || row[`Contactos Compras ${i}`]);
      const emailRaw = str(row[`Email Compras ${i}`]);
      const whatsappRaw = row[`WhatsApp Compras ${i}`] as string | number | null;

      // If the next slot has a name but NO email, combine them as full name
      // e.g. D="Señorita" E="Vilma" → "Señorita Vilma"
      const namePart2 = i < 3 ? str(row[`Contactos  Compras ${i + 1}`] || row[`Contactos Compras ${i + 1}`]) : null;
      const nextEmailRaw = i < 3 ? str(row[`Email Compras ${i + 1}`]) : null;
      const nextHasEmail = nextEmailRaw ? !!extractEmail(nextEmailRaw) : false;
      const contactName = (namePart1 && namePart2 && !nextHasEmail)
        ? `${namePart1} ${namePart2}`
        : namePart1;

      const email = extractEmail(emailRaw);
      if (email) {
        contactInserts.push({
          tenant_id: tenantId,
          client_code: code,
          department: "purchasing",
          salutation: salutionCompras,
          contact_name: contactName,
          channel: "email",
          channel_value: email,
          priority: i - 1,
        });
      }

      const phone = normalizePhone(whatsappRaw);
      if (phone) {
        contactInserts.push({
          tenant_id: tenantId,
          client_code: code,
          department: "purchasing",
          salutation: salutionCompras,
          contact_name: contactName,
          channel: "whatsapp",
          channel_value: phone,
          priority: i - 1,
        });
      }
    }

    // Extract contacts - Imports department
    const salutionImport = str(row["Saludo Importaciones"]);
    const importContactName = str(row["Contacto Importaciones"]);
    for (let i = 1; i <= 4; i++) {
      const emailRaw = str(row[`Email Importaciones ${i}`]);
      const email = extractEmail(emailRaw);
      if (email) {
        contactInserts.push({
          tenant_id: tenantId,
          client_code: code,
          department: "imports",
          salutation: salutionImport,
          contact_name: importContactName,
          channel: "email",
          channel_value: email,
          priority: i - 1,
        });
      }
    }

    const importPhone = normalizePhone(row["WhatsApp Importaciones"] as string | number | null);
    if (importPhone) {
      contactInserts.push({
        tenant_id: tenantId,
        client_code: code,
        department: "imports",
        salutation: salutionImport,
        contact_name: importContactName,
        channel: "whatsapp",
        channel_value: importPhone,
        priority: 0,
      });
    }
  }

  // Deduplicate clients by client_code (keep last occurrence)
  const clientMap = new Map<string, Record<string, unknown>>();
  for (const c of clientInserts) {
    clientMap.set(c.client_code as string, c);
  }
  const dedupedClients = Array.from(clientMap.values());
  console.log(`   ${clientInserts.length} rows → ${dedupedClients.length} unique clients after dedup`);

  // Insert clients
  for (let i = 0; i < dedupedClients.length; i += 50) {
    const chunk = dedupedClients.slice(i, i + 50);
    const { error } = await supabase
      .from("clients")
      .upsert(chunk, { onConflict: "tenant_id,client_code" });
    if (error) console.error(`   Client insert error at batch ${i}:`, error.message);
  }
  console.log(`   ${dedupedClients.length} clients imported`);

  // Fetch client IDs for contact mapping
  const { data: clients } = await supabase
    .from("clients")
    .select("id, client_code")
    .eq("tenant_id", tenantId);

  const clientIdMap = new Map<string, string>();
  for (const c of clients || []) {
    clientIdMap.set(c.client_code, c.id);
  }

  // Insert contacts (with client_id resolved)
  const contactsRaw = contactInserts
    .map((c) => {
      const clientId = clientIdMap.get(c.client_code as string);
      if (!clientId) return null;
      const { client_code, ...rest } = c;
      return { ...rest, client_id: clientId };
    })
    .filter(Boolean) as Record<string, unknown>[];

  // Deduplicate by conflict key
  const contactUnique = new Map<string, Record<string, unknown>>();
  for (const c of contactsRaw) {
    const key = `${c.tenant_id}|${c.client_id}|${c.department}|${c.channel}|${c.channel_value}`;
    contactUnique.set(key, c);
  }
  const contactsWithIds = Array.from(contactUnique.values());

  for (let i = 0; i < contactsWithIds.length; i += 50) {
    const chunk = contactsWithIds.slice(i, i + 50);
    const { error } = await supabase
      .from("client_contacts")
      .upsert(chunk, {
        onConflict: "tenant_id,client_id,department,channel,channel_value",
      });
    if (error) console.error(`   Contact insert error at batch ${i}:`, error.message);
  }
  console.log(`   ${contactsWithIds.length} contacts imported`);

  // 5. Import client material preferences (BD2_CLIENTE_MP_REDUCIDA)
  console.log("\n5. Importing client material preferences (BD2_CLIENTE_MP_REDUCIDA)...");
  const prefSheet = wb.Sheets["BD2_CLIENTE_MP_REDUCIDA"];
  const prefRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(prefSheet);

  const prefInserts: Record<string, unknown>[] = [];
  let skippedPrefs = 0;

  const skipReasons = new Map<string, number>();
  for (const row of prefRows) {
    const clientCode = str(row["codigo cliente"]);
    const familiaRaw = str(row["FAMILIA"]);
    if (!clientCode || !familiaRaw) continue;

    const clientId = clientIdMap.get(clientCode);
    const familyId = familyMap.get(familiaRaw) || familyMap.get(familiaRaw.toLowerCase());

    if (!clientId || !familyId) {
      skippedPrefs++;
      const reason = !clientId ? `NO_CLIENT:${clientCode}` : `NO_FAMILY:${familiaRaw}`;
      skipReasons.set(reason, (skipReasons.get(reason) || 0) + 1);
      continue;
    }

    prefInserts.push({
      tenant_id: tenantId,
      client_id: clientId,
      family_id: familyId,
      uso: str(row["USO"]) || "",
      melt_index: row["MI"] != null ? Number(row["MI"]) || null : null,
      additives: str(row["ADD"]) || "",
    });
  }

  // Deduplicate by composite key
  const prefUnique = new Map<string, Record<string, unknown>>();
  for (const p of prefInserts) {
    const key = `${p.client_id}|${p.family_id}|${p.uso || ""}|${p.additives || ""}`;
    if (!prefUnique.has(key)) {
      prefUnique.set(key, p);
    }
  }
  const dedupedPrefs = Array.from(prefUnique.values());

  for (let i = 0; i < dedupedPrefs.length; i += 50) {
    const chunk = dedupedPrefs.slice(i, i + 50);
    const { error } = await supabase
      .from("client_material_preferences")
      .upsert(chunk, {
        onConflict: "tenant_id,client_id,family_id,uso,additives",
        ignoreDuplicates: true,
      });
    if (error) console.error(`   Pref insert error at batch ${i}:`, error.message);
  }
  console.log(`   ${dedupedPrefs.length} preferences imported (${skippedPrefs} skipped, ${prefInserts.length - dedupedPrefs.length} deduplicated)`);
  if (skipReasons.size > 0) {
    console.log("   Skip reasons:");
    for (const [reason, count] of [...skipReasons.entries()].sort((a,b) => b[1]-a[1])) {
      console.log(`     ${count}x ${reason}`);
    }
  }

  // Summary
  console.log("\n=== IMPORT COMPLETE ===");
  console.log(`Tenant: ${tenant.name} (${tenantId})`);
  console.log(`Families: ${families?.length}`);
  console.log(`Grades: ${gradeInserts.length}`);
  console.log(`Clients: ${clientInserts.length}`);
  console.log(`Contacts: ${contactsWithIds.length}`);
  console.log(`Material Prefs: ${dedupedPrefs.length}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
