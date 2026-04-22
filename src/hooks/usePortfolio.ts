import { useState, useCallback, useEffect, useMemo } from "react";
import { Asset, AssetCalculated, Transaction } from "@/types/portfolio";
import { calculateAsset, parseCSV } from "@/lib/portfolio";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { fetchAllPaginated } from "@/lib/supabasePagination";

/** Recalculate an asset's quantity, averagePrice, totalInvested from transactions */
function applyTransactions(assets: Asset[], transactions: Transaction[]): Asset[] {
  const txByTicker: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    if (!txByTicker[tx.ticker]) txByTicker[tx.ticker] = [];
    txByTicker[tx.ticker].push(tx);
  }

  const updatedAssets = assets.map((a) => {
    const txs = txByTicker[a.ticker];
    if (!txs) return a;
    delete txByTicker[a.ticker];
    return recalcFromTx(a, txs);
  });

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
  let qty = asset.quantity;
  let totalCost = asset.totalInvested;
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    if (tx.type === "buy") {
      totalCost += tx.quantity * tx.price + tx.otherCosts;
      qty += tx.quantity;
    } else {
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

// Map DB row to Asset
function rowToAsset(row: any): Asset {
  return {
    id: row.id,
    ticker: row.ticker,
    quantity: Number(row.quantity),
    currentPrice: Number(row.current_price),
    isManualPrice: row.is_manual_price,
    averagePrice: Number(row.average_price),
    totalInvested: Number(row.total_invested),
    dividendYield: Number(row.dividend_yield),
    pvp: Number(row.pvp),
  };
}

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    assetType: row.asset_type,
    ticker: row.ticker,
    date: row.date,
    quantity: Number(row.quantity),
    price: Number(row.price),
    otherCosts: Number(row.other_costs),
    total: Number(row.total),
  };
}

export function usePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [baseAssets, setBaseAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        // Paginated reads guarantee correctness even when a user has >1000 transactions.
        const [assetsData, txData] = await Promise.all([
          fetchAllPaginated<any>("assets", "*", (q) => q.eq("user_id", user.id)),
          fetchAllPaginated<any>("transactions", "*", (q) => q.eq("user_id", user.id)),
        ]);
        setBaseAssets(assetsData.map(rowToAsset));
        const dates = assetsData
          .map((r: any) => new Date(r.updated_at))
          .filter((d) => !isNaN(d.getTime()));
        if (dates.length > 0) setLastUpdated(new Date(Math.max(...dates.map((d) => d.getTime()))));
        setTransactions(txData.map(rowToTransaction));
      } catch (e: any) {
        toast({ title: "Erro ao carregar dados", description: e?.message ?? String(e), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, toast]);

  const assets = useMemo(() => applyTransactions(baseAssets, transactions), [baseAssets, transactions]);

  const totalPortfolio = assets.reduce((sum, a) => sum + a.quantity * a.currentPrice, 0);
  const calculatedAssets: AssetCalculated[] = assets.map((a) => calculateAsset(a, totalPortfolio));

  const addAsset = useCallback(async (asset: Omit<Asset, "id">) => {
    if (!user) return;
    const { data, error } = await supabase.from("assets").insert({
      user_id: user.id,
      ticker: asset.ticker,
      quantity: asset.quantity,
      current_price: asset.currentPrice,
      is_manual_price: asset.isManualPrice,
      average_price: asset.averagePrice,
      total_invested: asset.totalInvested,
      dividend_yield: asset.dividendYield,
      pvp: asset.pvp,
    }).select().single();
    if (error) { toast({ title: "Erro ao adicionar ativo", description: error.message, variant: "destructive" }); return; }
    if (data) setBaseAssets((prev) => [...prev, rowToAsset(data)]);
  }, [user, toast]);

  const updateAsset = useCallback(async (id: string, updates: Partial<Omit<Asset, "id">>) => {
    const dbUpdates: any = {};
    if (updates.ticker !== undefined) dbUpdates.ticker = updates.ticker;
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
    if (updates.isManualPrice !== undefined) dbUpdates.is_manual_price = updates.isManualPrice;
    if (updates.averagePrice !== undefined) dbUpdates.average_price = updates.averagePrice;
    if (updates.totalInvested !== undefined) dbUpdates.total_invested = updates.totalInvested;
    if (updates.dividendYield !== undefined) dbUpdates.dividend_yield = updates.dividendYield;
    if (updates.pvp !== undefined) dbUpdates.pvp = updates.pvp;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase.from("assets").update(dbUpdates).eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar ativo", description: error.message, variant: "destructive" }); return; }
    setBaseAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, [toast]);

  const removeAsset = useCallback(async (id: string) => {
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao remover ativo", description: error.message, variant: "destructive" }); return; }
    setBaseAssets((prev) => prev.filter((a) => a.id !== id));
  }, [toast]);

  const importCSV = useCallback(async (csvText: string) => {
    if (!user) return 0;
    const parsed = parseCSV(csvText);
    const rows = parsed.map((a) => ({
      user_id: user.id,
      ticker: a.ticker,
      quantity: a.quantity,
      current_price: a.currentPrice,
      is_manual_price: a.isManualPrice,
      average_price: a.averagePrice,
      total_invested: a.totalInvested,
      dividend_yield: a.dividendYield,
      pvp: a.pvp,
    }));
    const { data, error } = await supabase.from("assets").insert(rows).select();
    if (error) { toast({ title: "Erro ao importar CSV", description: error.message, variant: "destructive" }); return 0; }
    if (data) setBaseAssets((prev) => [...prev, ...data.map(rowToAsset)]);
    return data?.length ?? 0;
  }, [user, toast]);

  const addTransaction = useCallback(async (tx: Omit<Transaction, "id">) => {
    if (!user) return;
    const { data, error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: tx.type,
      asset_type: tx.assetType,
      ticker: tx.ticker,
      date: tx.date,
      quantity: tx.quantity,
      price: tx.price,
      other_costs: tx.otherCosts,
      total: tx.total,
    }).select().single();
    if (error) { toast({ title: "Erro ao adicionar lançamento", description: error.message, variant: "destructive" }); return; }
    if (data) setTransactions((prev) => [...prev, rowToTransaction(data)]);

    // If ticker doesn't exist yet in base assets, create it
    const exists = baseAssets.some((a) => a.ticker === tx.ticker);
    if (!exists) {
      const { data: assetData } = await supabase.from("assets").insert({
        user_id: user.id,
        ticker: tx.ticker,
        quantity: 0,
        current_price: tx.price,
        is_manual_price: true,
        average_price: 0,
        total_invested: 0,
        dividend_yield: 0,
        pvp: 0,
      }).select().single();
      if (assetData) setBaseAssets((prev) => [...prev, rowToAsset(assetData)]);
    }
  }, [user, toast, baseAssets]);

  const removeTransaction = useCallback(async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao remover lançamento", description: error.message, variant: "destructive" }); return; }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, [toast]);

  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0, status: "" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      const results: Record<string, { price: number | null; dividendYield: number | null; pvp: number | null }> = data?.results || {};
      const errors: string[] = [];

      // Update in DB and state
      const updatedAssets = baseAssets.map((a) => {
        const quote = results[a.ticker];
        if (quote && typeof quote.price === "number") {
          const updates: Partial<Asset> = { currentPrice: quote.price, isManualPrice: false };
          if (typeof quote.dividendYield === "number") {
            updates.dividendYield = quote.dividendYield;
          }
          if (typeof quote.pvp === "number") {
            updates.pvp = quote.pvp;
          }
          // Update in DB (fire and forget)
          supabase.from("assets").update({
            current_price: quote.price,
            is_manual_price: false,
            ...(typeof quote.dividendYield === "number" ? { dividend_yield: quote.dividendYield } : {}),
            ...(typeof quote.pvp === "number" ? { pvp: quote.pvp } : {}),
            updated_at: new Date().toISOString(),
          }).eq("id", a.id).then();
          return { ...a, ...updates };
        }
        errors.push(a.ticker);
        return a;
      });

      setBaseAssets(updatedAssets);
      setLastUpdated(new Date());
      setFetchProgress({
        current: total,
        total,
        status: errors.length ? `Concluído (falha: ${errors.join(", ")})` : "Concluído!",
      });
    } catch {
      setFetchProgress({ current: 0, total, status: "Erro ao buscar cotações" });
    }

    setTimeout(() => setFetchProgress({ current: 0, total: 0, status: "" }), 3000);
  }, [assets, baseAssets]);

  const totals = {
    totalCurrent: calculatedAssets.reduce((s, a) => s + a.totalCurrent, 0),
    totalInvested: calculatedAssets.reduce((s, a) => s + a.totalInvested, 0),
    totalDifference: calculatedAssets.reduce((s, a) => s + a.difference, 0),
    totalVariation: calculatedAssets.reduce((s, a) => s + a.totalVariationPerShare, 0),
    totalMonthlyDY: assets.reduce((s, a) => s + (a.dividendYield * a.quantity), 0),
  };

  return { assets, calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, addTransaction, removeTransaction, transactions, fetchAllPrices, fetchProgress, totals, loading, lastUpdated };
}
