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

  const fetchPrice = useCallback(async (id: string, ticker: string) => {
    try {
      const res = await fetch(
        `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=demo`
      );
      const data = await res.json();
      const price = data?.results?.[0]?.regularMarketPrice;
      if (typeof price === "number") {
        setAssets((prev) =>
          prev.map((a) => (a.id === id ? { ...a, currentPrice: price, isManualPrice: false } : a))
        );
        return price;
      }
      throw new Error("Preço não encontrado");
    } catch {
      throw new Error("Erro ao buscar cotação");
    }
  }, []);

  const totals = {
    totalCurrent: calculatedAssets.reduce((s, a) => s + a.totalCurrent, 0),
    totalInvested: calculatedAssets.reduce((s, a) => s + a.totalInvested, 0),
    totalDifference: calculatedAssets.reduce((s, a) => s + a.difference, 0),
    totalVariation: calculatedAssets.reduce((s, a) => s + a.totalVariationPerShare, 0),
  };

  return { assets, calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, fetchPrice, totals };
}
