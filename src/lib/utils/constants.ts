export const MATERIAL_FAMILIES = [
  { code: "HDPE", displayName: "Polietileno Alta Densidad", aliases: ["Alta", "ALTA", "alta", "HDPE", "HD", "hdpe"] },
  { code: "LDPE", displayName: "Polietileno Baja Densidad", aliases: ["Baja", "BAJA", "baja", "LDPE", "LD", "ldpe"] },
  { code: "LLDPE", displayName: "Polietileno Lineal", aliases: ["Lineal", "LINEAL", "lineal", "LLDPE", "LLD", "lldpe"] },
  { code: "PP", displayName: "Polipropileno", aliases: ["PP", "pp"] },
  { code: "ABS", displayName: "ABS", aliases: ["ABS", "abs"] },
  { code: "PET", displayName: "PET", aliases: ["PET", "pet"] },
  { code: "GPPS", displayName: "Poliestireno Cristal", aliases: ["GPPS", "gpps", "PS Cristal"] },
  { code: "HIPS", displayName: "Poliestireno Alto Impacto", aliases: ["HIPS", "hips", "PS Alto Impacto"] },
  { code: "EPS", displayName: "Poliestireno Expandible", aliases: ["EPS", "eps"] },
  { code: "EVA", displayName: "Etileno Vinil Acetato", aliases: ["EVA", "eva"] },
  { code: "PC", displayName: "Policarbonato", aliases: ["PC", "pc"] },
  { code: "PVC", displayName: "PVC", aliases: ["PVC", "pvc"] },
  { code: "PA6", displayName: "Poliamida 6", aliases: ["PA6", "pa6", "Nylon", "nylon"] },
  { code: "SAN", displayName: "SAN", aliases: ["SAN", "san"] },
  { code: "PLA", displayName: "Acido Polilactico", aliases: ["PLA", "pla"] },
  { code: "CaCO3", displayName: "Carbonato de Calcio", aliases: ["CaCO3", "caco3", "CACO3"] },
  { code: "POM", displayName: "Poliacetal", aliases: ["POM", "pom", "Acetal"] },
  { code: "PMMA", displayName: "Polimetilmetacrilato", aliases: ["PMMA", "pmma", "Acrilico"] },
] as const;

export function findFamilyByAlias(alias: string): (typeof MATERIAL_FAMILIES)[number] | undefined {
  const trimmed = alias.trim();
  return MATERIAL_FAMILIES.find((f) =>
    f.aliases.some((a) => a === trimmed)
  );
}

export const CLIENT_STATUS_MAP: Record<string, string> = {
  Activo: "active",
  activo: "active",
  Prospecto: "prospect",
  prospecto: "prospect",
  Inactivo: "inactive",
  inactivo: "inactive",
};

export const CLIENT_TYPE_MAP: Record<string, string> = {
  Transformador: "transformer",
  transformador: "transformer",
  Distribuidor: "distributor",
  distribuidor: "distributor",
  Rotomoldeo: "rotomolding",
  rotomoldeo: "rotomolding",
};
