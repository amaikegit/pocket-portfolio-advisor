import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Dividend { ticker: string; amount: number; payment_date: string; year: number; month: number; }

const PAGE_SIZE = 1000;
async function fetchAllPaginated<T = any>(
  client: any, table: string, columns: string, apply?: (q: any) => any,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    let q = client.from(table).select(columns).order("created_at", { ascending: true });
    if (apply) q = apply(q);
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function detectFrequencyDays(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
    if (d > 0) diffs.push(d);
  }
  if (!diffs.length) return null;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)]; // median
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Allow either: user-triggered (with auth) or scheduled (no auth → all users)
    let userIds: string[] = [];
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) userIds = [u.user.id];
    }
    if (userIds.length === 0) {
      // Paginate to ensure we capture all users, not just the first 1000 asset rows.
      const distinctUsers = await fetchAllPaginated<{ user_id: string }>(
        supabase, "assets", "user_id",
      );
      userIds = [...new Set(distinctUsers.map((r) => r.user_id))];
    }

    let inserted = 0;
    const today = new Date();

    for (const userId of userIds) {
      const [assets, dividends, settingsRes] = await Promise.all([
        fetchAllPaginated<{ ticker: string; quantity: number }>(
          supabase, "assets", "ticker, quantity", (q) => q.eq("user_id", userId),
        ),
        fetchAllPaginated<Dividend>(
          supabase, "dividends", "ticker, amount, payment_date, year, month",
          (q) => q.eq("user_id", userId),
        ),
        supabase.from("user_settings").select("monthly_dividend_goal").eq("user_id", userId).maybeSingle(),
      ]);
      const settings = settingsRes.data;

      const newAlerts: any[] = [];

      // ===== 1) SILENT DIVIDEND DETECTION =====
      const heldTickers = new Set((assets ?? []).filter((a) => Number(a.quantity) > 0).map((a) => a.ticker));
      const byTicker: Record<string, Dividend[]> = {};
      for (const d of (dividends ?? []) as Dividend[]) {
        if (!heldTickers.has(d.ticker)) continue;
        (byTicker[d.ticker] ??= []).push(d);
      }

      for (const [ticker, divs] of Object.entries(byTicker)) {
        if (divs.length < 3) continue; // need history to detect a pattern
        const dates = divs.map((d) => d.payment_date);
        const median = detectFrequencyDays(dates);
        if (!median) continue;

        const lastDate = new Date([...dates].sort().pop()!);
        const daysSince = (today.getTime() - lastDate.getTime()) / 86400000;
        // Tolerance: 1.5x expected interval, plus 7 days buffer
        const threshold = median * 1.5 + 7;
        if (daysSince > threshold) {
          const monthsSince = Math.floor(daysSince / 30);
          const expected = median <= 45 ? "mensal" : median <= 100 ? "trimestral" : median <= 200 ? "semestral" : "anual";
          newAlerts.push({
            user_id: userId,
            type: "silent_dividend",
            title: `${ticker} parou de pagar dividendos`,
            message: `Última distribuição há ~${monthsSince} ${monthsSince === 1 ? "mês" : "meses"}. Frequência detectada: ${expected}.`,
            severity: "warning",
            ticker,
            metadata: { last_payment: lastDate.toISOString().slice(0, 10), median_days: Math.round(median), days_since: Math.round(daysSince) },
            dedupe_key: `silent:${ticker}:${lastDate.toISOString().slice(0, 7)}`,
          });
        }
      }

      // ===== 2) MONTHLY GOAL PROGRESS =====
      const goal = Number(settings?.monthly_dividend_goal ?? 0);
      if (goal > 0) {
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        const received = (dividends ?? [])
          .filter((d) => d.month === month && d.year === year)
          .reduce((s, d) => s + Number(d.amount), 0);
        const pct = (received / goal) * 100;
        const periodKey = `${year}-${String(month).padStart(2, "0")}`;

        const milestones = [
          { threshold: 100, severity: "success", title: "🎉 Meta mensal atingida!", message: `Você atingiu 100% da meta de R$ ${goal.toFixed(2)} em ${periodKey}.` },
          { threshold: 80, severity: "success", title: "Quase lá! 80% da meta", message: `Você já recebeu R$ ${received.toFixed(2)} (80%+ da meta de R$ ${goal.toFixed(2)}).` },
          { threshold: 50, severity: "info", title: "Metade da meta alcançada", message: `Você já recebeu R$ ${received.toFixed(2)} (50%+ da meta mensal de R$ ${goal.toFixed(2)}).` },
        ];
        for (const m of milestones) {
          if (pct >= m.threshold) {
            newAlerts.push({
              user_id: userId,
              type: "goal_progress",
              title: m.title,
              message: m.message,
              severity: m.severity,
              metadata: { received, goal, pct: Math.round(pct), period: periodKey },
              dedupe_key: `goal:${periodKey}:${m.threshold}`,
            });
            break; // only highest milestone reached
          }
        }
      }

      if (newAlerts.length > 0) {
        const { data, error } = await supabase
          .from("alerts")
          .upsert(newAlerts, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
          .select();
        if (error) console.error("upsert alerts:", error);
        else inserted += data?.length ?? 0;
      }
    }

    return new Response(JSON.stringify({ users: userIds.length, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compute-alerts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
