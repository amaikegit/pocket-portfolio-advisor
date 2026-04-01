import { useState, useCallback, useEffect } from "react";
import { Asset, AssetCalculated } from "@/types/portfolio";
import { calculateAsset, parseCSV } from "@/lib/portfolio";

const STORAGE_KEY = "portfolio-assets";

function loadAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function usePortfolio() {
  const [assets, setAssets] = useState<Asset[]>(loadAssets);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  }, [assets]);

  const totalPortfolio = assets.reduce((sum, a) => sum + a.quantity * a.currentPrice, 0);

  const calculatedAssets: AssetCalculated[] = assets.map((a) =>
    calculateAsset(a, totalPortfolio)
  );

  const addAsset = useCallback((asset: Omit<Asset, "id">) => {
    setAssets((prev) => [...prev, { ...asset, id: crypto.randomUUID() }]);
  }, []);

  const updateAsset = useCallback((id: string, updates: Partial<Omit<Asset, "id">>) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const importCSV = useCallback((csvText: string) => {
    const parsed = parseCSV(csvText);
    const newAssets: Asset[] = parsed.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
    }));
    setAssets((prev) => [...prev, ...newAssets]);
    return newAssets.length;
  }, []);

  const fetchAllPrices = useCallback(async () => {
    const tickers = assets.map((a) => a.ticker).join(",");
    if (!tickers) return;
    try {
      const res = await fetch(
        `https://brapi.dev/api/quote/${encodeURIComponent(tickers)}?token=demo`
      );
      const data = await res.json();
      const results: { symbol: string; regularMarketPrice: number }[] = data?.results || [];
      setAssets((prev) =>
        prev.map((a) => {
          const match = results.find((r) => r.symbol === a.ticker);
          if (match && typeof match.regularMarketPrice === "number") {
            return { ...a, currentPrice: match.regularMarketPrice, isManualPrice: false };
          }
          return a;
        })
      );
    } catch {
      throw new Error("Erro ao buscar cotações");
    }
  }, [assets]);

  const totals = {
    totalCurrent: calculatedAssets.reduce((s, a) => s + a.totalCurrent, 0),
    totalInvested: calculatedAssets.reduce((s, a) => s + a.totalInvested, 0),
    totalDifference: calculatedAssets.reduce((s, a) => s + a.difference, 0),
    totalVariation: calculatedAssets.reduce((s, a) => s + a.totalVariationPerShare, 0),
  };

  return { assets, calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, fetchAllPrices, totals };
}
