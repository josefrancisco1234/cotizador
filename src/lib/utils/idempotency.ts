import { createHash } from "crypto";

export function generateIdempotencyKey(parts: {
  tenantId: string;
  clientId: string;
  gradeId: string;
  priceUsd: number;
  date: string; // YYYY-MM-DD
}): string {
  const raw = `${parts.tenantId}|${parts.clientId}|${parts.gradeId}|${parts.priceUsd}|${parts.date}`;
  return createHash("sha256").update(raw).digest("hex");
}
