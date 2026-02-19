/**
 * Matching Engine
 *
 * Core algorithm that connects a grade code to the list of clients
 * who should receive a quotation for that material.
 *
 * Flow:
 * 1. grade_code -> product_grades (lookup by normalized code)
 * 2. product_grades -> family_id + uso
 * 3. family_id + uso -> client_material_preferences -> client_ids
 * 4. client_ids -> client_contacts -> recipient list
 * 5. Idempotency check to avoid duplicate sends
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGradeCode, stripFamilyPrefix } from "./grade-normalizer";
import { generateIdempotencyKey } from "../utils/idempotency";
import { createAdminClient } from "../supabase/admin";

export interface MatchedRecipient {
  clientId: string;
  clientCode: string;
  businessName: string;
  contactId: string;
  contactName: string | null;
  salutation: string | null;
  channel: "email" | "whatsapp";
  channelValue: string;
  department: string;
}

export interface MatchResult {
  status: "matched" | "unknown" | "ambiguous" | "no_clients";
  gradeCode: string;
  grade?: {
    id: string;
    gradeCode: string;
    familyId: string;
    familyCode: string;
    familyDisplayName: string;
    uso: string | null;
    process: string | null;
    brand: string | null;
    manufacturer: string | null;
    attributes: string | null;
    meltIndexLabel: string | null;
  };
  recipients: MatchedRecipient[];
  warnings: string[];
  candidates?: { id: string; gradeCode: string }[];
}

export async function matchGradeToRecipients(
  supabase: SupabaseClient,
  tenantId: string,
  gradeCode: string,
  priceUsd?: number,
): Promise<MatchResult> {
  const warnings: string[] = [];
  const normalized = normalizeGradeCode(gradeCode);

  // ── STEP 1: Grade Lookup ──────────────────────────────
  let { data: grade } = await supabase
    .from("product_grades")
    .select(`
      id, grade_code, grade_code_normalized, uso, process, brand, manufacturer,
      attributes, melt_index_label, family_id,
      family:material_families!inner(id, code, display_name)
    `)
    .eq("tenant_id", tenantId)
    .eq("grade_code_normalized", normalized)
    .single();

  // ── STEP 1b: Prefix-stripped exact match ─────────────
  // Handles "PP GJ-570" → strip "PP" → look up "GJ570"
  if (!grade) {
    const stripped = stripFamilyPrefix(normalized);
    if (stripped) {
      const { data: strippedGrade } = await supabase
        .from("product_grades")
        .select(`
          id, grade_code, grade_code_normalized, uso, process, brand, manufacturer,
          attributes, melt_index_label, family_id,
          family:material_families!inner(id, code, display_name)
        `)
        .eq("tenant_id", tenantId)
        .eq("grade_code_normalized", stripped)
        .single();

      if (strippedGrade) {
        grade = strippedGrade;
        warnings.push(`Prefix-stripped match: "${gradeCode}" matched to "${grade.grade_code}"`);
      }
    }
  }

  if (!grade) {
    // Fuzzy fallback: partial match (try stripped prefix first if available)
    const fuzzyTerm = stripFamilyPrefix(normalized) ?? normalized;
    const { data: candidates } = await supabase
      .from("product_grades")
      .select("id, grade_code, grade_code_normalized")
      .eq("tenant_id", tenantId)
      .ilike("grade_code_normalized", `%${fuzzyTerm}%`)
      .limit(5);

    if (candidates && candidates.length === 1) {
      // Single candidate: use it with warning
      const { data: singleGrade } = await supabase
        .from("product_grades")
        .select(`
          id, grade_code, grade_code_normalized, uso, process, brand, manufacturer,
          attributes, melt_index_label, family_id,
          family:material_families!inner(id, code, display_name)
        `)
        .eq("id", candidates[0].id)
        .single();

      if (singleGrade) {
        grade = singleGrade;
        warnings.push(`Fuzzy match: "${gradeCode}" matched to "${grade.grade_code}" (partial)`);
      }
    } else if (candidates && candidates.length > 1) {
      return {
        status: "ambiguous",
        gradeCode,
        recipients: [],
        warnings: [`Grade "${gradeCode}" matches multiple candidates`],
        candidates: candidates.map((c) => ({ id: c.id, gradeCode: c.grade_code })),
      };
    } else {
      return {
        status: "unknown",
        gradeCode,
        recipients: [],
        warnings: [`Grade "${gradeCode}" not found in technical bible`],
      };
    }
  }

  if (!grade) {
    return {
      status: "unknown",
      gradeCode,
      recipients: [],
      warnings: [`Grade "${gradeCode}" could not be resolved`],
    };
  }

  const family = grade.family as unknown as { id: string; code: string; display_name: string };

  const gradeInfo = {
    id: grade.id,
    gradeCode: grade.grade_code,
    familyId: family.id,
    familyCode: family.code,
    familyDisplayName: family.display_name,
    uso: grade.uso,
    process: grade.process,
    brand: grade.brand,
    manufacturer: grade.manufacturer,
    attributes: grade.attributes,
    meltIndexLabel: grade.melt_index_label,
  };

  // ── STEP 2: Find matching client material preferences ─
  let query = supabase
    .from("client_material_preferences")
    .select("client_id")
    .eq("tenant_id", tenantId)
    .eq("family_id", family.id);

  // If grade has a specific USO, match clients with that USO or null/empty USO
  if (grade.uso) {
    const usoLower = grade.uso.toLowerCase().trim();
    // We need to get all prefs for this family and filter in memory
    // because Supabase doesn't support OR with NULL easily in a clean way
    const { data: allPrefs } = await supabase
      .from("client_material_preferences")
      .select("client_id, uso")
      .eq("tenant_id", tenantId)
      .eq("family_id", family.id);

    const matchedClientIds = new Set<string>();
    for (const pref of allPrefs || []) {
      const prefUso = pref.uso?.trim().toLowerCase();
      if (!prefUso || prefUso === "" || prefUso === usoLower) {
        matchedClientIds.add(pref.client_id);
      }
    }

    // If no USO-specific matches, widen to all clients with this family
    if (matchedClientIds.size === 0) {
      warnings.push(`No clients found for USO "${grade.uso}", widened to all family "${family.code}" clients`);
      for (const pref of allPrefs || []) {
        matchedClientIds.add(pref.client_id);
      }
    }

    if (matchedClientIds.size === 0) {
      return {
        status: "no_clients",
        gradeCode,
        grade: gradeInfo,
        recipients: [],
        warnings: [...warnings, `No clients found for family "${family.code}"`],
      };
    }

    // ── STEP 3: Get active clients and their contacts ─────
    const clientIds = Array.from(matchedClientIds);
    const { data: clientsWithContacts } = await supabase
      .from("clients")
      .select(`
        id, client_code, business_name, status,
        contacts:client_contacts(
          id, department, salutation, contact_name, channel, channel_value, priority
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("id", clientIds)
      .order("client_code");

    const recipients: MatchedRecipient[] = [];
    const today = new Date().toISOString().split("T")[0];

    for (const client of clientsWithContacts || []) {
      const contacts = (client.contacts as unknown as Array<{
        id: string;
        department: string;
        salutation: string | null;
        contact_name: string | null;
        channel: "email" | "whatsapp";
        channel_value: string;
        priority: number;
      }>) || [];

      // Filter to purchasing and imports departments, active contacts
      const relevantContacts = contacts
        .filter((c) => c.department === "purchasing" || c.department === "imports")
        .sort((a, b) => a.priority - b.priority);

      if (relevantContacts.length === 0) {
        warnings.push(`Client "${client.business_name}" (${client.client_code}) has no active contacts`);
        continue;
      }

      for (const contact of relevantContacts) {
        // Check idempotency if price is provided
        if (priceUsd != null) {
          const idempotencyKey = generateIdempotencyKey({
            tenantId,
            clientId: client.id,
            gradeId: grade.id,
            priceUsd,
            date: today,
          });

          const { data: existing } = await supabase
            .from("quotation_recipients")
            .select("id")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();

          if (existing) {
            continue; // Already sent today for this combo
          }
        }

        recipients.push({
          clientId: client.id,
          clientCode: client.client_code,
          businessName: client.business_name,
          contactId: contact.id,
          contactName: contact.contact_name,
          salutation: contact.salutation,
          channel: contact.channel,
          channelValue: contact.channel_value,
          department: contact.department,
        });
      }
    }

    return {
      status: "matched",
      gradeCode,
      grade: gradeInfo,
      recipients,
      warnings,
    };
  }

  // Grade has no USO: match all clients with this family
  const { data: allPrefs } = await query;
  const clientIds = [...new Set((allPrefs || []).map((p) => p.client_id))];

  if (clientIds.length === 0) {
    return {
      status: "no_clients",
      gradeCode,
      grade: gradeInfo,
      recipients: [],
      warnings: [...warnings, `No clients found for family "${family.code}"`],
    };
  }

  const { data: clientsWithContacts } = await supabase
    .from("clients")
    .select(`
      id, client_code, business_name,
      contacts:client_contacts(
        id, department, salutation, contact_name, channel, channel_value, priority
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("id", clientIds);

  const recipients: MatchedRecipient[] = [];

  for (const client of clientsWithContacts || []) {
    const contacts = (client.contacts as unknown as Array<{
      id: string;
      department: string;
      salutation: string | null;
      contact_name: string | null;
      channel: "email" | "whatsapp";
      channel_value: string;
      priority: number;
    }>) || [];

    const relevantContacts = contacts
      .filter((c) => c.department === "purchasing" || c.department === "imports")
      .sort((a, b) => a.priority - b.priority);

    if (relevantContacts.length === 0) {
      warnings.push(`Client "${client.business_name}" (${client.client_code}) has no active contacts`);
      continue;
    }

    for (const contact of relevantContacts) {
      recipients.push({
        clientId: client.id,
        clientCode: client.client_code,
        businessName: client.business_name,
        contactId: contact.id,
        contactName: contact.contact_name,
        salutation: contact.salutation,
        channel: contact.channel,
        channelValue: contact.channel_value,
        department: contact.department,
      });
    }
  }

  return {
    status: "matched",
    gradeCode,
    grade: gradeInfo,
    recipients,
    warnings,
  };
}

/**
 * Run matching engine for all price entries in an ingestion.
 * Creates a quotation with matched recipients.
 */
export async function runMatchingForIngestion(
  ingestionId: string,
  tenantId: string,
): Promise<{ matched: number; unknown: number; total: number }> {
  const supabase = createAdminClient();

  // Get all price entries for this ingestion
  const { data: entries } = await supabase
    .from("price_entries")
    .select("*")
    .eq("ingestion_id", ingestionId);

  if (!entries || entries.length === 0) {
    return { matched: 0, unknown: 0, total: 0 };
  }

  let matched = 0;
  let unknown = 0;
  const allRecipients: Array<{
    matchResult: MatchResult;
    priceEntry: typeof entries[0];
  }> = [];

  for (const entry of entries) {
    const result = await matchGradeToRecipients(
      supabase,
      tenantId,
      entry.raw_grade_text,
      entry.price_usd,
    );

    if (result.status === "matched" && result.grade) {
      matched++;

      // Update price entry with grade match
      await supabase
        .from("price_entries")
        .update({
          grade_id: result.grade.id,
          is_matched: true,
          match_confidence: result.warnings.length > 0 ? 0.8 : 1.0,
        })
        .eq("id", entry.id);

      if (result.recipients.length > 0) {
        allRecipients.push({ matchResult: result, priceEntry: entry });
      }
    } else {
      unknown++;
    }
  }

  // Create quotation if there are matched recipients
  if (allRecipients.length > 0) {
    const { data: quotation } = await supabase
      .from("quotations")
      .insert({
        tenant_id: tenantId,
        ingestion_id: ingestionId,
        title: `Auto-cotizacion ${new Date().toISOString().split("T")[0]}`,
        status: "draft",
        total_recipients: allRecipients.reduce(
          (sum, r) => sum + r.matchResult.recipients.length,
          0,
        ),
      })
      .select()
      .single();

    if (quotation) {
      // Create quotation items and recipients
      for (const { matchResult, priceEntry } of allRecipients) {
        if (!matchResult.grade) continue;

        const { data: item } = await supabase
          .from("quotation_items")
          .insert({
            quotation_id: quotation.id,
            price_entry_id: priceEntry.id,
            grade_id: matchResult.grade.id,
            price_usd: priceEntry.price_usd,
          })
          .select()
          .single();

        if (!item) continue;

        const today = new Date().toISOString().split("T")[0];
        const recipientRows = matchResult.recipients.map((r) => ({
          tenant_id: tenantId,
          quotation_id: quotation.id,
          client_id: r.clientId,
          contact_id: r.contactId,
          channel: r.channel,
          idempotency_key: generateIdempotencyKey({
            tenantId,
            clientId: r.clientId,
            gradeId: matchResult.grade!.id,
            priceUsd: priceEntry.price_usd,
            date: today,
          }),
          dispatch_status: "pending" as const,
        }));

        // Insert recipients, skip duplicates
        for (const row of recipientRows) {
          await supabase
            .from("quotation_recipients")
            .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true });
        }
      }
    }
  }

  return { matched, unknown, total: entries.length };
}
