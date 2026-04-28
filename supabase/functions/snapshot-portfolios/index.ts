import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Paginated fetch to bypass PostgREST's default 1000-row limit.
// Uses range() in chunks of PAGE_SIZE until fewer than PAGE_SIZE rows return.
const PAGE_SIZE = 1000;
async function fetchAllPaginated<T = any>(
  supabase: any,
  table: string,
  columns: string,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Stable ordering is required for range() to be deterministic across pages.
  // We order by created_at (present on both `assets` and `transactions`) as tiebreaker.
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all assets and transactions with pagination to avoid the 1000-row cap.
    const [assets, txs] = await Promise.all([
      fetchAllPaginated<{
        user_id: string; ticker: string; quantity: number;
        current_price: number; total_invested: number;
      }>(supabase, "assets", "user_id, ticker, quantity, current_price, total_invested"),
      fetchAllPaginated<{
        user_id: string; ticker: string; type: string;
        quantity: number; price: number; other_costs: number;
      }>(supabase, "transactions", "user_id, ticker, type, quantity, price, other_costs"),
    ]);
    console.log(`snapshot-portfolios: loaded ${assets.length} assets, ${txs.length} transactions`);

    // Recalc qty/cost from transactions per (user, ticker)
    type Key = string;
    const txMap = new Map<Key, { qty: number; cost: number }>();
    for (const t of txs ?? []) {
      const k = `${t.user_id}::${t.ticker}`;
      const cur = txMap.get(k) ?? { qty: 0, cost: 0 };
      const q = Number(t.quantity), p = Number(t.price), o = Number(t.other_costs ?? 0);
      if (t.type === "buy") {
        cur.cost += q * p + o;
        cur.qty += q;
      } else if (cur.qty > 0) {
        const avg = cur.cost / cur.qty;
        cur.qty = Math.max(0, cur.qty - q);
        cur.cost = cur.qty * avg;
      }
      txMap.set(k, cur);
    }

    // Aggregate per user
    const perUser = new Map<string, { current: number; invested: number }>();
    const seen = new Set<string>();

    for (const a of assets ?? []) {
      const k = `${a.user_id}::${a.ticker}`;
      seen.add(k);
      const tx = txMap.get(k);
      // Trust the asset row's quantity/cost when transactions are incomplete
      // (e.g. user imported positions via CSV without a full historical tx log).
      // Only use transaction-derived numbers when they meet or exceed the asset
      // row, which signals that the tx history is the authoritative source.
      const assetQty = Number(a.quantity);
      const assetInvested = Number(a.total_invested);
      const useTx = tx && tx.qty >= assetQty && tx.qty > 0;
      const qty = useTx ? tx!.qty : assetQty;
      const invested = useTx ? tx!.cost : assetInvested;
      const cur = perUser.get(a.user_id) ?? { current: 0, invested: 0 };
      cur.current += qty * Number(a.current_price);
      cur.invested += invested;
      perUser.set(a.user_id, cur);
    }
    // Tickers only in transactions (no asset row) — skip current price (unknown)
    for (const [k, v] of txMap.entries()) {
      if (seen.has(k)) continue;
      const [user_id] = k.split("::");
      const cur = perUser.get(user_id) ?? { current: 0, invested: 0 };
      cur.invested += v.cost;
      perUser.set(user_id, cur);
    }

    const today = new Date().toISOString().slice(0, 10);
    const rows = Array.from(perUser.entries()).map(([user_id, v]) => ({
      user_id,
      snapshot_date: today,
      total_current: Math.round(v.current * 100) / 100,
      total_invested: Math.round(v.invested * 100) / 100,
      total_difference: Math.round((v.current - v.invested) * 100) / 100,
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("portfolio_snapshots")
        .upsert(rows, { onConflict: "user_id,snapshot_date" });
      if (error) throw error;
    }

    console.log(`Snapshots: ${rows.length} users on ${today}`);
    return new Response(JSON.stringify({ users: rows.length, date: today }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("snapshot-portfolios error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
