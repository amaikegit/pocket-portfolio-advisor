import { useState, useCallback, useEffect, useMemo } from "react";
import { Asset, AssetCalculated, Transaction } from "@/types/portfolio";
import { calculateAsset, parseCSV } from "@/lib/portfolio";

const STORAGE_KEY = "portfolio-assets";
const TX_STORAGE_KEY = "portfolio-transactions";

function loadAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(TX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Recalculate an asset's quantity, averagePrice, totalInvested from transactions */
function applyTransactions(assets: Asset[], transactions: Transaction[]): Asset[] {
  // Group transactions by ticker
  const txByTicker: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    if (!txByTicker[tx.ticker]) txByTicker[tx.ticker] = [];
    txByTicker[tx.ticker].push(tx);
  }

  // Update existing assets
  const updatedAssets = assets.map((a) => {
    const txs = txByTicker[a.ticker];
    if (!txs) return a;
    delete txByTicker[a.ticker];
    return recalcFromTx(a, txs);
  });

  // Create new assets from tickers not yet in portfolio
  for (const [ticker, txs] of Object.entries(txByTicker)) {
    const base: Asset = {
      id: crypto.randomUUID(),
      ticker,
      quantity: 0,
      currentPrice: 0,
      isManualPrice: true,
      averagePrice: 0,
      totalInvested: 0,
      dividendYield: 0,
      pvp: 0,
    };
    updatedAssets.push(recalcFromTx(base, txs));
  }

  return updatedAssets;
}

function recalcFromTx(asset: Asset, txs: Transaction[]): Asset {
  let qty = 0;
  let totalCost = 0;

  // Sort by date
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    if (tx.type === "buy") {
      totalCost += tx.quantity * tx.price + tx.otherCosts;
      qty += tx.quantity;
    } else {
      // sell
      if (qty > 0) {
        const avgBefore = totalCost / qty;
        qty -= tx.quantity;
        if (qty < 0) qty = 0;
        totalCost = qty * avgBefore;
      }
    }
  }

  const avgPrice = qty > 0 ? totalCost / qty : 0;

  return {
    ...asset,
    quantity: qty,
    averagePrice: Math.round(avgPrice * 100) / 100,
    totalInvested: Math.round(totalCost * 100) / 100,
  };
}

export function usePortfolio() {
  const [baseAssets, setBaseAssets] = useState<Asset[]>(loadAssets);
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);

  // Merge base assets with transaction data
  const assets = useMemo(() => applyTransactions(baseAssets, transactions), [baseAssets, transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baseAssets));
  }, [baseAssets]);

  useEffect(() => {
    localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const totalPortfolio = assets.reduce((sum, a) => sum + a.quantity * a.currentPrice, 0);

  const calculatedAssets: AssetCalculated[] = assets.map((a) =>
    calculateAsset(a, totalPortfolio)
  );

  const addAsset = useCallback((asset: Omit<Asset, "id">) => {
    setBaseAssets((prev) => [...prev, { ...asset, id: crypto.randomUUID() }]);
  }, []);

  const updateAsset = useCallback((id: string, updates: Partial<Omit<Asset, "id">>) => {
    setBaseAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const removeAsset = useCallback((id: string) => {
    setBaseAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const importCSV = useCallback((csvText: string) => {
    const parsed = parseCSV(csvText);
    const newAssets: Asset[] = parsed.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
    }));
    setBaseAssets((prev) => [...prev, ...newAssets]);
    return newAssets.length;
  }, []);

  const addTransaction = useCallback((tx: Omit<Transaction, "id">) => {
    const newTx: Transaction = { ...tx, id: crypto.randomUUID() };
    setTransactions((prev) => [...prev, newTx]);

    // If ticker doesn't exist yet in base assets, create it
    setBaseAssets((prev) => {
      const exists = prev.some((a) => a.ticker === tx.ticker);
      if (!exists) {
        return [...prev, {
          id: crypto.randomUUID(),
          ticker: tx.ticker,
          quantity: 0,
          currentPrice: tx.price,
          isManualPrice: true,
          averagePrice: 0,
          totalInvested: 0,
          dividendYield: 0,
          pvp: 0,
        }];
      }
      return prev;
    });
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

      setBaseAssets((prev) =>
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

  const removeTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { assets, calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, addTransaction, removeTransaction, transactions, fetchAllPrices, fetchProgress, totals };
}
