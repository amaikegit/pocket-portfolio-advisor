import { RatingBreakdown, RatingCriterionKey, RatingCriterionResult } from "@/types/portfolio";

export interface RatingWeights {
  valuation: number;
  dividendYield: number;
  priceVsAverage: number;
  unrealizedPnL: number;
  concentration: number;
  dividendConsistency: number;
}

export interface RatingThresholds {
  valuation: { excellent: number; good: number; fair: number };
  dividendYield: { excellent: number; good: number; fair: number };
  priceVsAverage: { excellent: number; good: number; fair: number };
  concentration: { idealMin: number; idealMax: number; highMax: number; lowMin: number };
  dividendConsistency: { excellent: number; good: number; fair: number };
}

export interface RatingSettings {
  weights: RatingWeights;
  thresholds: RatingThresholds;
  enabledCriteria: RatingCriterionKey[];
}

export interface RatingInput {
  pvp: number;
  monthlyProfitability: number; // %
  priceVariation: number;       // currentPrice - averagePrice (BRL)
  averagePrice: number;
  difference: number;
  totalInvested: number;
  portfolioProportion: number;  // %
  dividendMonthsLast12: number; // 0..12
}

export interface RatingContext {
  dividendMonthsLast12?: number;
}

export const DEFAULT_RATING_SETTINGS: RatingSettings = {
  weights: {
    valuation: 25,
    dividendYield: 25,
    priceVsAverage: 15,
    unrealizedPnL: 15,
    concentration: 10,
    dividendConsistency: 10,
  },
  thresholds: {
    valuation: { excellent: 0.85, good: 1.0, fair: 1.1 },
    dividendYield: { excellent: 1.0, good: 0.7, fair: 0.4 },
    priceVsAverage: { excellent: -5, good: 0, fair: 10 },
    concentration: { idealMin: 5, idealMax: 15, highMax: 25, lowMin: 2 },
    dividendConsistency: { excellent: 10, good: 6, fair: 1 },
  },
  enabledCriteria: [
    "valuation",
    "dividendYield",
    "priceVsAverage",
    "unrealizedPnL",
    "concentration",
    "dividendConsistency",
  ],
};

export interface RatingPreset {
  id: string;
  name: string;
  description: string;
  settings: RatingSettings;
}

/** Estratégias predefinidas para configuração rápida do rating. */
export const STRATEGY_PRESETS: RatingPreset[] = [
  {
    id: "balanced",
    name: "Moderada",
    description: "Equilíbrio entre rentabilidade e segurança. Configuração padrão recomendada.",
    settings: DEFAULT_RATING_SETTINGS,
  },
  {
    id: "income",
    name: "Rentabilidade (Renda)",
    description: "Prioriza dividend yield e consistência de proventos para foco em renda passiva.",
    settings: {
      weights: {
        valuation: 15,
        dividendYield: 35,
        priceVsAverage: 10,
        unrealizedPnL: 10,
        concentration: 5,
        dividendConsistency: 25,
      },
      thresholds: {
        valuation: { excellent: 0.9, good: 1.05, fair: 1.2 },
        dividendYield: { excellent: 0.9, good: 0.6, fair: 0.35 },
        priceVsAverage: { excellent: -5, good: 0, fair: 10 },
        concentration: { idealMin: 5, idealMax: 15, highMax: 25, lowMin: 2 },
        dividendConsistency: { excellent: 10, good: 7, fair: 3 },
      },
      enabledCriteria: [
        "valuation",
        "dividendYield",
        "priceVsAverage",
        "unrealizedPnL",
        "concentration",
        "dividendConsistency",
      ],
    },
  },
  {
    id: "safety",
    name: "Segurança",
    description: "Valoriza valuation conservador, baixa concentração e histórico consistente de proventos.",
    settings: {
      weights: {
        valuation: 30,
        dividendYield: 15,
        priceVsAverage: 10,
        unrealizedPnL: 10,
        concentration: 20,
        dividendConsistency: 15,
      },
      thresholds: {
        valuation: { excellent: 0.8, good: 0.95, fair: 1.05 },
        dividendYield: { excellent: 0.8, good: 0.5, fair: 0.3 },
        priceVsAverage: { excellent: -3, good: 2, fair: 8 },
        concentration: { idealMin: 4, idealMax: 12, highMax: 18, lowMin: 1.5 },
        dividendConsistency: { excellent: 11, good: 8, fair: 4 },
      },
      enabledCriteria: [
        "valuation",
        "dividendYield",
        "priceVsAverage",
        "unrealizedPnL",
        "concentration",
        "dividendConsistency",
      ],
    },
  },
  {
    id: "aggressive",
    name: "Agressiva",
    description: "Foca em oportunidades de preço e resultado, tolera maior concentração e ignora consistência.",
    settings: {
      weights: {
        valuation: 30,
        dividendYield: 10,
        priceVsAverage: 30,
        unrealizedPnL: 25,
        concentration: 5,
        dividendConsistency: 0,
      },
      thresholds: {
        valuation: { excellent: 0.9, good: 1.1, fair: 1.3 },
        dividendYield: { excellent: 1.2, good: 0.8, fair: 0.5 },
        priceVsAverage: { excellent: -8, good: -2, fair: 5 },
        concentration: { idealMin: 8, idealMax: 25, highMax: 40, lowMin: 1 },
        dividendConsistency: { excellent: 10, good: 6, fair: 1 },
      },
      enabledCriteria: [
        "valuation",
        "dividendYield",
        "priceVsAverage",
        "unrealizedPnL",
        "concentration",
      ],
    },
  },
];

const LABELS: Record<RatingCriterionKey, string> = {
  valuation: "Valuation (P/VP)",
  dividendYield: "Dividend Yield mensal",
  priceVsAverage: "Posição vs preço médio",
  unrealizedPnL: "Resultado não realizado",
  concentration: "Concentração na carteira",
  dividendConsistency: "Consistência de proventos",
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** P/VP: lower is better. 0 = no data => neutral 0.5. */
function scoreValuation(pvp: number, t: RatingThresholds["valuation"]): { sub: number; detail: string } {
  if (!pvp || pvp <= 0) return { sub: 0.5, detail: "P/VP indisponível" };
  let sub: number;
  if (pvp < t.excellent) sub = 1.0;
  else if (pvp < t.good) sub = 0.7;
  else if (pvp < t.fair) sub = 0.4;
  else sub = 0.1;
  return { sub, detail: `P/VP ${pvp.toFixed(2)}` };
}

function scoreDividendYield(monthly: number, t: RatingThresholds["dividendYield"]): { sub: number; detail: string } {
  let sub: number;
  if (monthly > t.excellent) sub = 1.0;
  else if (monthly > t.good) sub = 0.7;
  else if (monthly > t.fair) sub = 0.4;
  else sub = 0.1;
  return { sub, detail: `${monthly.toFixed(2)}%/mês` };
}

function scorePriceVsAverage(
  priceVariation: number,
  averagePrice: number,
  t: RatingThresholds["priceVsAverage"],
): { sub: number; detail: string } {
  if (averagePrice <= 0) return { sub: 0.5, detail: "Sem preço médio" };
  const pct = (priceVariation / averagePrice) * 100;
  let sub: number;
  if (pct < t.excellent) sub = 1.0;
  else if (pct < t.good) sub = 0.7;
  else if (pct < t.fair) sub = 0.5;
  else sub = 0.3;
  return { sub, detail: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs PM` };
}

function scoreUnrealizedPnL(difference: number, totalInvested: number): { sub: number; detail: string } {
  if (totalInvested <= 0) return { sub: 0.5, detail: "Sem investimento" };
  const pct = (difference / totalInvested) * 100;
  // Map: -50% -> 0, 0% -> 0.5, +50% -> 1.0 (linear, clamped)
  const sub = clamp(0.5 + pct / 100, 0, 1);
  return { sub, detail: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% resultado` };
}

function scoreConcentration(prop: number, t: RatingThresholds["concentration"]): { sub: number; detail: string } {
  let sub: number;
  if (prop >= t.idealMin && prop <= t.idealMax) sub = 1.0;
  else if (prop > t.idealMax && prop <= t.highMax) sub = 0.6;
  else if (prop > t.highMax) sub = 0.2;
  else if (prop < t.lowMin) sub = 0.5;
  else sub = 0.7; // between lowMin and idealMin
  return { sub, detail: `${prop.toFixed(1)}% da carteira` };
}

function scoreDividendConsistency(months: number, t: RatingThresholds["dividendConsistency"]): { sub: number; detail: string } {
  let sub: number;
  if (months >= t.excellent) sub = 1.0;
  else if (months >= t.good) sub = 0.6;
  else if (months >= t.fair) sub = 0.3;
  else sub = 0.0;
  return { sub, detail: `${months}/12 meses` };
}

export function computeRating(input: RatingInput, settingsArg?: RatingSettings): RatingBreakdown {
  const settings = settingsArg ?? DEFAULT_RATING_SETTINGS;
  const enabled = new Set<RatingCriterionKey>(settings.enabledCriteria);
  const w = settings.weights;
  const t = settings.thresholds;

  const raw: { key: RatingCriterionKey; sub: number; detail: string; weight: number }[] = [
    { key: "valuation",           ...scoreValuation(input.pvp, t.valuation),                                       weight: w.valuation },
    { key: "dividendYield",       ...scoreDividendYield(input.monthlyProfitability, t.dividendYield),              weight: w.dividendYield },
    { key: "priceVsAverage",      ...scorePriceVsAverage(input.priceVariation, input.averagePrice, t.priceVsAverage), weight: w.priceVsAverage },
    { key: "unrealizedPnL",       ...scoreUnrealizedPnL(input.difference, input.totalInvested),                    weight: w.unrealizedPnL },
    { key: "concentration",       ...scoreConcentration(input.portfolioProportion, t.concentration),               weight: w.concentration },
    { key: "dividendConsistency", ...scoreDividendConsistency(input.dividendMonthsLast12, t.dividendConsistency),  weight: w.dividendConsistency },
  ];

  // Normalize weights of enabled criteria so total possible = 100.
  const enabledItems = raw.filter((r) => enabled.has(r.key));
  const sumWeights = enabledItems.reduce((s, r) => s + r.weight, 0) || 1;
  const norm = 100 / sumWeights;

  const items: RatingCriterionResult[] = raw.map((r) => {
    const isOn = enabled.has(r.key);
    const normalizedWeight = isOn ? r.weight * norm : 0;
    return {
      key: r.key,
      label: LABELS[r.key],
      detail: r.detail,
      score: isOn ? r.sub * normalizedWeight : 0,
      weight: normalizedWeight,
      enabled: isOn,
    };
  });

  const total = items.reduce((s, it) => s + it.score, 0);
  const stars = clamp(Math.round(total / 20), 1, 5);

  return { total, stars, items };
}