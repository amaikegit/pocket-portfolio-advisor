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
        quantity: number; price: number; other_costs: number; date: string;
      }>(supabase, "transactions", "user_id, ticker, type, quantity, price, other_costs, date"),
    ]);
    console.log(`snapshot-portfolios: loaded ${assets.length} assets, ${txs.length} transactions`);

    // Group transactions by (user, ticker), sorted by date for correct avg-cost math.
    type Key = string;
    const txByKey = new Map<Key, Array<{ type: string; quantity: number; price: number; other_costs: number; date?: string }>>();
    for (const t of txs ?? []) {
      const k = `${t.user_id}::${t.ticker}`;
      if (!txByKey.has(k)) txByKey.set(k, []);
      txByKey.get(k)!.push(t as any);
    }

    // Mirrors the frontend `recalcFromTx` in src/hooks/usePortfolio.ts:
    // transactions are applied ON TOP of the asset row's stored quantity/cost,
    // not as a replacement. This ensures the snapshot matches the dashboard.
    function applyTx(
      baseQty: number,
      baseCost: number,
      list: Array<{ type: string; quantity: number; price: number; other_costs: number; date?: string }>,
    ): { qty: number; cost: number } {
      let qty = baseQty;
      let cost = baseCost;
      const sorted = [...list].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
      for (const tx of sorted) {
        const q = Number(tx.quantity), p = Number(tx.price), o = Number(tx.other_costs ?? 0);
        if (tx.type === "buy") {
          cost += q * p + o;
          qty += q;
        } else if (qty > 0) {
          const avg = cost / qty;
          qty = Math.max(0, qty - q);
          cost = qty * avg;
        }
      }
      return { qty, cost };
    }

    // Aggregate per user
    const perUser = new Map<string, { current: number; invested: number }>();
    const seen = new Set<string>();

    for (const a of assets ?? []) {
      const k = `${a.user_id}::${a.ticker}`;
      seen.add(k);
      const list = txByKey.get(k);
      const baseQty = Number(a.quantity);
      const baseInvested = Number(a.total_invested);
      const { qty, cost } = list && list.length > 0
        ? applyTx(baseQty, baseInvested, list)
        : { qty: baseQty, cost: baseInvested };
      const cur = perUser.get(a.user_id) ?? { current: 0, invested: 0 };
      cur.current += qty * Number(a.current_price);
      cur.invested += cost;
      perUser.set(a.user_id, cur);
    }
    // Tickers only in transactions (no asset row) — skip current price (unknown).
    for (const [k, list] of txByKey.entries()) {
      if (seen.has(k)) continue;
      const [user_id] = k.split("::");
      const { cost } = applyTx(0, 0, list);
      const cur = perUser.get(user_id) ?? { current: 0, invested: 0 };
      cur.invested += cost;
      perUser.set(user_id, cur);
    }

    // Snapshot date no fuso de Brasília (America/Sao_Paulo)
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
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
