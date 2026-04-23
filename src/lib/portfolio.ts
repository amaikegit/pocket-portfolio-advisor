import { Asset, AssetCalculated } from "@/types/portfolio";
import { computeRating, RatingSettings, RatingContext } from "@/lib/rating";

export function calculateAsset(
  asset: Asset,
  totalPortfolio: number,
  settings?: RatingSettings,
  ctx?: RatingContext,
): AssetCalculated {
  const totalCurrent = asset.quantity * asset.currentPrice;
  const difference = totalCurrent - asset.totalInvested;
  const monthlyProfitability = asset.currentPrice > 0 ? (asset.dividendYield / asset.currentPrice) * 100 : 0;
  const priceVariation = asset.currentPrice - asset.averagePrice;
  const portfolioProportion = totalPortfolio > 0 ? (totalCurrent / totalPortfolio) * 100 : 0;
  const totalVariationPerShare = priceVariation * asset.quantity;

  const breakdown = computeRating(
    {
      pvp: asset.pvp,
      monthlyProfitability,
      priceVariation,
      averagePrice: asset.averagePrice,
      difference,
      totalInvested: asset.totalInvested,
      portfolioProportion,
      dividendMonthsLast12: ctx?.dividendMonthsLast12 ?? 0,
    },
    settings,
  );

  return {
    ...asset,
    totalCurrent,
    difference,
    monthlyProfitability,
    priceVariation,
    rating: breakdown.stars,
    ratingScore: breakdown.total,
    ratingBreakdown: breakdown,
    portfolioProportion,
    totalVariationPerShare,
  };
}

export function parseCSV(csvText: string): Omit<Asset, "id">[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());

  return lines.slice(1).filter(l => l.trim()).map((line) => {
    const values = line.split(";").map((v) => v.trim());
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? values[idx] : "";
    };

    const parseNum = (val: string) => {
      const cleaned = val.replace(/\./g, "").replace(",", ".");
      return parseFloat(cleaned) || 0;
    };

    return {
      ticker: get("ticker") || get("ativo") || "",
      quantity: parseNum(get("quantidade") || get("qty") || get("cotas") || "0"),
      currentPrice: parseNum(get("preco_atual") || get("valor_atual") || get("preco") || "0"),
      isManualPrice: true,
      averagePrice: parseNum(get("preco_medio") || get("pm") || "0"),
      totalInvested: parseNum(get("total_investido") || get("investido") || "0"),
      dividendYield: parseNum(get("dy") || get("dividend_yield") || "0"),
      pvp: parseNum(get("pvp") || get("p_vp") || "0"),
    };
  }).filter(a => a.ticker);
}
