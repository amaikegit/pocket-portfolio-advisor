import { suggestClassification } from "./fiiClassification";
import { suggestStockClassification } from "./stockClassification";

export type AssetKind = "fii" | "stock";

/** Known Brazilian stock units (end in 11 but are NOT FIIs). */
const STOCK_UNITS = new Set([
  "SANB11", "BPAC11", "KLBN11", "TAEE11", "ENGI11", "SAPR11",
  "ALUP11", "BIDI11", "JPSA11", "SULA11", "AZUL11", "OIBR11",
]);

/**
 * Decide whether a ticker should be treated as a FII or a stock (ação).
 * Heuristic:
 *   - tickers ending in 11 → FII (unless in STOCK_UNITS or known stock map)
 *   - tickers ending in 3/4/5/6 → stock
 */
export function getAssetKind(ticker: string): AssetKind {
  const t = (ticker || "").trim().toUpperCase();
  if (/11$/.test(t)) {
    if (STOCK_UNITS.has(t)) return "stock";
    if (suggestStockClassification(t) && !suggestClassification(t)) return "stock";
    return "fii";
  }
  return "stock";
}