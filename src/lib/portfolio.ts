import { Asset, AssetCalculated } from "@/types/portfolio";

export function calculateAsset(asset: Asset, totalPortfolio: number): AssetCalculated {
  const totalCurrent = asset.quantity * asset.currentPrice;
  const difference = totalCurrent - asset.totalInvested;
  const monthlyProfitability = asset.currentPrice > 0 ? (asset.dividendYield / asset.currentPrice) * 100 : 0;
  const priceVariation = asset.currentPrice - asset.averagePrice;

  let rating = 0;
  if (asset.pvp > 0 && asset.pvp < 1) rating++;
  if (monthlyProfitability > 0.80) rating++;
  if (priceVariation < 0) rating++;
  // Map 0-3 criteria to 1-5 stars
  if (rating === 3) rating = 5;
  else if (rating === 2) rating = 4;
  else if (rating === 1) rating = 3;
  else rating = 2;

  const portfolioProportion = totalPortfolio > 0 ? (totalCurrent / totalPortfolio) * 100 : 0;
  const totalVariationPerShare = priceVariation * asset.quantity;

  return {
    ...asset,
    totalCurrent,
    difference,
    monthlyProfitability,
    priceVariation,
    rating,
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
