import { z } from "zod";

export const ingestionCreateSchema = z.object({
  rawHtml: z.string().min(1, "HTML content is required"),
  sourceSubject: z.string().optional(),
  sourceFrom: z.string().optional(),
  sourceIdentifier: z.string().optional(),
  supplierId: z.string().uuid().optional(),
});

export const manualPriceEntrySchema = z.object({
  gradeCode: z.string().min(1),
  priceUsd: z.number().positive(),
  incoterm: z.string().default("CFR"),
  port: z.string().default("CALLAO"),
});

export const quotationApproveSchema = z.object({
  paymentTerms: z.string().default("CAD / 30 dias"),
  shipmentTerms: z.string().default("4-6 semanas"),
});

export const clientCreateSchema = z.object({
  clientCode: z.string().min(1),
  businessName: z.string().min(1),
  ruc: z.string().optional(),
  zone: z.string().optional(),
  status: z.enum(["active", "prospect", "inactive"]).default("active"),
  clientType: z.enum(["transformer", "distributor", "transformer_distributor", "rotomolding"]).optional(),
});

export const gradeSearchSchema = z.object({
  query: z.string().min(1),
  familyCode: z.string().optional(),
  uso: z.string().optional(),
});
