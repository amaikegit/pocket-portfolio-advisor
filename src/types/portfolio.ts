export interface Asset {
  id: string;
  ticker: string;
  quantity: number;
  currentPrice: number;
  isManualPrice: boolean;
  averagePrice: number;
  totalInvested: number;
  dividendYield: number;
  pvp: number;
}

export interface AssetCalculated extends Asset {
  totalCurrent: number;
  difference: number;
  monthlyProfitability: number;
  priceVariation: number;
  rating: number;
  portfolioProportion: number;
  totalVariationPerShare: number;
  ratingScore: number;
  ratingBreakdown: RatingBreakdown;
}

export type RatingCriterionKey =
  | "valuation"
  | "dividendYield"
  | "priceVsAverage"
  | "unrealizedPnL"
  | "concentration"
  | "dividendConsistency";

export interface RatingCriterionResult {
  key: RatingCriterionKey;
  label: string;
  detail: string;
  score: number;       // 0..weight (contribution to total)
  weight: number;      // configured weight
  enabled: boolean;
}

export interface RatingBreakdown {
  total: number; // 0..100
  stars: number; // 1..5
  items: RatingCriterionResult[];
}

export type TransactionType = "buy" | "sell";
export type AssetType = "acoes" | "fiis" | "bdrs" | "etfs" | "cripto";

export interface Transaction {
  id: string;
  type: TransactionType;
  assetType: AssetType;
  ticker: string;
  date: string;
  quantity: number;
  price: number;
  otherCosts: number;
  total: number;
}
