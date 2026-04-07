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

  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0, status: "" });

  const fetchAllPrices = useCallback(async () => {
    const total = assets.length;
    if (!total) return;
    setFetchProgress({ current: 0, total, status: "Buscando cotações..." });

    try {
      const tickers = assets.map((a) => a.ticker);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-quotes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ tickers }),
        }
      );
      const data = await res.json();
      const results: Record<string, number | null> = data?.results || {};
      const errors: string[] = [];

      setAssets((prev) =>
        prev.map((a) => {
          const price = results[a.ticker];
          if (typeof price === "number") {
            return { ...a, currentPrice: price, isManualPrice: false };
          }
          errors.push(a.ticker);
          return a;
        })
      );

      setFetchProgress({
        current: total,
        total,
        status: errors.length ? `Concluído (falha: ${errors.join(", ")})` : "Concluído!",
      });
    } catch {
      setFetchProgress({ current: 0, total, status: "Erro ao buscar cotações" });
    }

    setTimeout(() => setFetchProgress({ current: 0, total: 0, status: "" }), 3000);
  }, [assets]);

  const totals = {
    totalCurrent: calculatedAssets.reduce((s, a) => s + a.totalCurrent, 0),
    totalInvested: calculatedAssets.reduce((s, a) => s + a.totalInvested, 0),
    totalDifference: calculatedAssets.reduce((s, a) => s + a.difference, 0),
    totalVariation: calculatedAssets.reduce((s, a) => s + a.totalVariationPerShare, 0),
  };

  return { assets, calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, fetchAllPrices, fetchProgress, totals };
}
