// Auto-classification of common Brazilian FIIs.
// User-edited values (asset.fiiType / asset.fiiSegment) always take precedence.

export const FII_TYPES = [
  "Tijolo",
  "Papel",
  "Fundo de Fundos",
  "Híbrido",
  "Desenvolvimento",
  "Agronegócio",
] as const;

export const FII_SEGMENTS = [
  "Logística",
  "Lajes Corporativas",
  "Shoppings",
  "Renda Urbana",
  "Residencial",
  "Hospitais",
  "Educacional",
  "Hotéis",
  "Agências Bancárias",
  "Recebíveis (CRI)",
  "Fundo de Fundos",
  "Híbrido",
  "Agronegócio",
  "Desenvolvimento",
  "Outros",
] as const;

export type FiiType = typeof FII_TYPES[number];
export type FiiSegment = typeof FII_SEGMENTS[number];

interface Classification { type: FiiType; segment: FiiSegment }

// Curated map of well-known tickers. Extend as needed.
const KNOWN: Record<string, Classification> = {
  // Logística
  HGLG11: { type: "Tijolo", segment: "Logística" },
  XPLG11: { type: "Tijolo", segment: "Logística" },
  VILG11: { type: "Tijolo", segment: "Logística" },
  BTLG11: { type: "Tijolo", segment: "Logística" },
  LVBI11: { type: "Tijolo", segment: "Logística" },
  GGRC11: { type: "Tijolo", segment: "Logística" },
  BRCO11: { type: "Tijolo", segment: "Logística" },
  ALZR11: { type: "Tijolo", segment: "Logística" },
  // Lajes Corporativas
  HGRE11: { type: "Tijolo", segment: "Lajes Corporativas" },
  PVBI11: { type: "Tijolo", segment: "Lajes Corporativas" },
  BRCR11: { type: "Tijolo", segment: "Lajes Corporativas" },
  RCRB11: { type: "Tijolo", segment: "Lajes Corporativas" },
  KNRI11: { type: "Híbrido", segment: "Híbrido" },
  JSRE11: { type: "Tijolo", segment: "Lajes Corporativas" },
  RBRP11: { type: "Tijolo", segment: "Lajes Corporativas" },
  // Shoppings
  XPML11: { type: "Tijolo", segment: "Shoppings" },
  VISC11: { type: "Tijolo", segment: "Shoppings" },
  HSML11: { type: "Tijolo", segment: "Shoppings" },
  HGBS11: { type: "Tijolo", segment: "Shoppings" },
  MALL11: { type: "Tijolo", segment: "Shoppings" },
  VRTA11: { type: "Papel", segment: "Recebíveis (CRI)" },
  // Papel / Recebíveis
  KNCR11: { type: "Papel", segment: "Recebíveis (CRI)" },
  KNIP11: { type: "Papel", segment: "Recebíveis (CRI)" },
  KNHY11: { type: "Papel", segment: "Recebíveis (CRI)" },
  IRDM11: { type: "Papel", segment: "Recebíveis (CRI)" },
  RECR11: { type: "Papel", segment: "Recebíveis (CRI)" },
  RBRR11: { type: "Papel", segment: "Recebíveis (CRI)" },
  HGCR11: { type: "Papel", segment: "Recebíveis (CRI)" },
  CPTS11: { type: "Papel", segment: "Recebíveis (CRI)" },
  MXRF11: { type: "Híbrido", segment: "Híbrido" },
  // FoF
  BCFF11: { type: "Fundo de Fundos", segment: "Fundo de Fundos" },
  HFOF11: { type: "Fundo de Fundos", segment: "Fundo de Fundos" },
  RBRF11: { type: "Fundo de Fundos", segment: "Fundo de Fundos" },
  KFOF11: { type: "Fundo de Fundos", segment: "Fundo de Fundos" },
  // Renda Urbana / Agências
  HGRU11: { type: "Tijolo", segment: "Renda Urbana" },
  RBVA11: { type: "Tijolo", segment: "Agências Bancárias" },
  // Hospitais / Educação
  HCTR11: { type: "Papel", segment: "Recebíveis (CRI)" },
  HUSC11: { type: "Tijolo", segment: "Hospitais" },
  RBED11: { type: "Tijolo", segment: "Educacional" },
  // Agro
  KNCA11: { type: "Agronegócio", segment: "Agronegócio" },
  RZAG11: { type: "Agronegócio", segment: "Agronegócio" },
};

/** Heuristic: any ticker ending in "11" is treated as a FII candidate. */
export function isFiiTicker(ticker: string): boolean {
  return /11$/.test(ticker.trim().toUpperCase());
}

export function suggestClassification(ticker: string): Classification | null {
  const k = ticker.trim().toUpperCase();
  return KNOWN[k] ?? null;
}

/** Resolve final classification: manual override > suggestion > "Outros". */
export function resolveClassification(
  ticker: string,
  manualType?: string | null,
  manualSegment?: string | null,
): Classification | null {
  if (!isFiiTicker(ticker)) return null;
  const suggestion = suggestClassification(ticker);
  const type = (manualType?.trim() || suggestion?.type || "Tijolo") as FiiType;
  const segment = (manualSegment?.trim() || suggestion?.segment || "Outros") as FiiSegment;
  return { type, segment };
}
