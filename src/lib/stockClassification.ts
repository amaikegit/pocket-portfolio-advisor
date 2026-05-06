// Auto-classification of common Brazilian stocks (ações).
// User-edited values (asset.fiiType / asset.fiiSegment) — reused as
// generic "type/segment" columns — always take precedence.

export const STOCK_SECTORS = [
  "Financeiro",
  "Energia Elétrica",
  "Petróleo, Gás e Biocombustíveis",
  "Mineração e Siderurgia",
  "Consumo não Cíclico",
  "Consumo Cíclico",
  "Saúde",
  "Tecnologia",
  "Telecomunicações",
  "Bens Industriais",
  "Materiais Básicos",
  "Utilidade Pública",
  "Construção e Imobiliário",
  "Transporte e Logística",
  "Educação",
  "Outros",
] as const;

export const STOCK_INDUSTRIES = [
  "Bancos",
  "Seguros",
  "Bolsa e Serviços Financeiros",
  "Energia Elétrica",
  "Saneamento",
  "Petróleo e Gás",
  "Mineração",
  "Siderurgia",
  "Papel e Celulose",
  "Alimentos",
  "Bebidas",
  "Varejo",
  "Vestuário",
  "E-commerce",
  "Saúde / Hospitais",
  "Saúde / Farmacêuticas",
  "Software / TI",
  "Telecom",
  "Aviação",
  "Logística",
  "Construção Civil",
  "Shoppings",
  "Educação",
  "Frigoríficos",
  "Outros",
] as const;

export type StockSector = typeof STOCK_SECTORS[number];
export type StockIndustry = typeof STOCK_INDUSTRIES[number];

interface Classification { sector: StockSector; industry: StockIndustry }

const KNOWN: Record<string, Classification> = {
  // Bancos
  ITUB4: { sector: "Financeiro", industry: "Bancos" },
  ITUB3: { sector: "Financeiro", industry: "Bancos" },
  BBDC4: { sector: "Financeiro", industry: "Bancos" },
  BBDC3: { sector: "Financeiro", industry: "Bancos" },
  BBAS3: { sector: "Financeiro", industry: "Bancos" },
  SANB11: { sector: "Financeiro", industry: "Bancos" },
  BPAC11: { sector: "Financeiro", industry: "Bancos" },
  ABCB4: { sector: "Financeiro", industry: "Bancos" },
  BRSR6: { sector: "Financeiro", industry: "Bancos" },
  // Seguros / Bolsa
  BBSE3: { sector: "Financeiro", industry: "Seguros" },
  PSSA3: { sector: "Financeiro", industry: "Seguros" },
  B3SA3: { sector: "Financeiro", industry: "Bolsa e Serviços Financeiros" },
  // Energia
  TAEE11: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  TAEE3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  TAEE4: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  EGIE3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  CPLE6: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  CPLE3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  CMIG4: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  CMIG3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  ELET3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  ELET6: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  ENBR3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  EQTL3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  ENGI11: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  AURE3: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  ISAE4: { sector: "Energia Elétrica", industry: "Energia Elétrica" },
  // Saneamento
  SBSP3: { sector: "Utilidade Pública", industry: "Saneamento" },
  SAPR11: { sector: "Utilidade Pública", industry: "Saneamento" },
  CSMG3: { sector: "Utilidade Pública", industry: "Saneamento" },
  // Petróleo
  PETR4: { sector: "Petróleo, Gás e Biocombustíveis", industry: "Petróleo e Gás" },
  PETR3: { sector: "Petróleo, Gás e Biocombustíveis", industry: "Petróleo e Gás" },
  PRIO3: { sector: "Petróleo, Gás e Biocombustíveis", industry: "Petróleo e Gás" },
  RECV3: { sector: "Petróleo, Gás e Biocombustíveis", industry: "Petróleo e Gás" },
  RRRP3: { sector: "Petróleo, Gás e Biocombustíveis", industry: "Petróleo e Gás" },
  UGPA3: { sector: "Petróleo, Gás e Biocombustíveis", industry: "Petróleo e Gás" },
  VBBR3: { sector: "Petróleo, Gás e Biocombustíveis", industry: "Petróleo e Gás" },
  // Mineração / Siderurgia
  VALE3: { sector: "Mineração e Siderurgia", industry: "Mineração" },
  CSNA3: { sector: "Mineração e Siderurgia", industry: "Siderurgia" },
  GGBR4: { sector: "Mineração e Siderurgia", industry: "Siderurgia" },
  GOAU4: { sector: "Mineração e Siderurgia", industry: "Siderurgia" },
  USIM5: { sector: "Mineração e Siderurgia", industry: "Siderurgia" },
  BRAP4: { sector: "Mineração e Siderurgia", industry: "Mineração" },
  // Papel e Celulose
  SUZB3: { sector: "Materiais Básicos", industry: "Papel e Celulose" },
  KLBN11: { sector: "Materiais Básicos", industry: "Papel e Celulose" },
  // Consumo
  ABEV3: { sector: "Consumo não Cíclico", industry: "Bebidas" },
  JBSS3: { sector: "Consumo não Cíclico", industry: "Frigoríficos" },
  MRFG3: { sector: "Consumo não Cíclico", industry: "Frigoríficos" },
  BRFS3: { sector: "Consumo não Cíclico", industry: "Alimentos" },
  CRFB3: { sector: "Consumo não Cíclico", industry: "Varejo" },
  ASAI3: { sector: "Consumo não Cíclico", industry: "Varejo" },
  PCAR3: { sector: "Consumo não Cíclico", industry: "Varejo" },
  // Varejo cíclico
  MGLU3: { sector: "Consumo Cíclico", industry: "E-commerce" },
  AMER3: { sector: "Consumo Cíclico", industry: "E-commerce" },
  LREN3: { sector: "Consumo Cíclico", industry: "Vestuário" },
  ARZZ3: { sector: "Consumo Cíclico", industry: "Vestuário" },
  SOMA3: { sector: "Consumo Cíclico", industry: "Vestuário" },
  // Saúde
  HAPV3: { sector: "Saúde", industry: "Saúde / Hospitais" },
  RDOR3: { sector: "Saúde", industry: "Saúde / Hospitais" },
  FLRY3: { sector: "Saúde", industry: "Saúde / Hospitais" },
  RADL3: { sector: "Saúde", industry: "Saúde / Farmacêuticas" },
  PNVL3: { sector: "Saúde", industry: "Saúde / Farmacêuticas" },
  HYPE3: { sector: "Saúde", industry: "Saúde / Farmacêuticas" },
  // Tech / Telecom
  TOTS3: { sector: "Tecnologia", industry: "Software / TI" },
  CASH3: { sector: "Tecnologia", industry: "Software / TI" },
  VIVT3: { sector: "Telecomunicações", industry: "Telecom" },
  TIMS3: { sector: "Telecomunicações", industry: "Telecom" },
  // Transporte / Logística
  RAIL3: { sector: "Transporte e Logística", industry: "Logística" },
  CCRO3: { sector: "Transporte e Logística", industry: "Logística" },
  AZUL4: { sector: "Transporte e Logística", industry: "Aviação" },
  GOLL4: { sector: "Transporte e Logística", industry: "Aviação" },
  STBP3: { sector: "Transporte e Logística", industry: "Logística" },
  RENT3: { sector: "Bens Industriais", industry: "Outros" },
  // Construção
  MRVE3: { sector: "Construção e Imobiliário", industry: "Construção Civil" },
  CYRE3: { sector: "Construção e Imobiliário", industry: "Construção Civil" },
  EZTC3: { sector: "Construção e Imobiliário", industry: "Construção Civil" },
  DIRR3: { sector: "Construção e Imobiliário", industry: "Construção Civil" },
  // Educação
  YDUQ3: { sector: "Educação", industry: "Educação" },
  COGN3: { sector: "Educação", industry: "Educação" },
  // Industrial
  WEGE3: { sector: "Bens Industriais", industry: "Outros" },
  EMBR3: { sector: "Bens Industriais", industry: "Outros" },
};

/** Heuristic: Brazilian stock tickers end with 3, 4, 5, 6 or 11 (units). */
export function isStockTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  // FIIs are also "11" — distinguish by checking known FII list first via isFiiTicker.
  return /^[A-Z]{4}(3|4|5|6|11)$/.test(t);
}

export function suggestStockClassification(ticker: string): Classification | null {
  const k = ticker.trim().toUpperCase();
  return KNOWN[k] ?? null;
}

export function resolveStockClassification(
  ticker: string,
  manualSector?: string | null,
  manualIndustry?: string | null,
): Classification | null {
  const suggestion = suggestStockClassification(ticker);
  const sector = (manualSector?.trim() || suggestion?.sector || "Outros") as StockSector;
  const industry = (manualIndustry?.trim() || suggestion?.industry || "Outros") as StockIndustry;
  return { sector, industry };
}