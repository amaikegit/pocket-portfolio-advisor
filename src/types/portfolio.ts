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
}
