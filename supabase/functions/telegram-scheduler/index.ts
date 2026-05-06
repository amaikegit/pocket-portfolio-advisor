import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRT_TZ = "America/Sao_Paulo";
const PAGE_SIZE = 1000;

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

function applyTx(baseQty: number, baseCost: number, list: any[]) {
  let qty = Number(baseQty) || 0;
  let cost = Number(baseCost) || 0;
  const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const tx of sorted) {
    const txQty = Number(tx.quantity) || 0;
    const txPrice = Number(tx.price) || 0;
    const txCosts = Number(tx.other_costs) || 0;
    if (tx.type === "buy") {
      cost += txQty * txPrice + txCosts;
      qty += txQty;
    } else {
      const avg = qty > 0 ? cost / qty : 0;
      cost = Math.max(0, cost - avg * txQty);
      qty = Math.max(0, qty - txQty);
    }
  }
  return { qty, cost };
}

async function getPortfolio(admin: any, userId: string) {
  const [assets, txs] = await Promise.all([
    fetchAllPaginated<any>(admin, "assets", "ticker, quantity, current_price, average_price, total_invested",
      (q) => q.eq("user_id", userId)),
    fetchAllPaginated<any>(admin, "transactions", "ticker, type, quantity, price, other_costs, date",
      (q) => q.eq("user_id", userId)),
  ]);
  const txByTicker = new Map<string, any[]>();
  for (const t of txs) {
    if (!txByTicker.has(t.ticker)) txByTicker.set(t.ticker, []);
    txByTicker.get(t.ticker)!.push(t);
  }
  let totalCurrent = 0, totalInvested = 0;
  const list: { ticker: string; totalCurrent: number; variation: number }[] = [];
  for (const a of assets) {
    const tlist = txByTicker.get(a.ticker) ?? [];
    const { qty, cost } = applyTx(a.quantity, a.total_invested, tlist);
    if (qty <= 0) continue;
    const cur = qty * Number(a.current_price);
    totalCurrent += cur;
    totalInvested += cost;
    const variation = cost > 0 ? ((cur - cost) / cost) * 100 : 0;
    list.push({ ticker: a.ticker, totalCurrent: cur, variation });
  }
  return { totalCurrent, totalInvested, diff: totalCurrent - totalInvested, list };
}

function brtNowParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: wdMap[get("weekday").slice(0, 3) as string] ?? 0,
  };
}

/** Offset (em minutos) do fuso BRT em relação a UTC nesta data. Ex.: -180. */
function brtOffsetMinutes(d: Date) {
  // Compara hora local representada no BRT vs UTC.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BRT_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? "0");
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - d.getTime()) / 60000);
}

/** Converte hora BRT (yyyy-mm-dd HH:mm) para Date UTC. */
function brtToUTC(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Aproxima usando o offset atual de BRT (sem horário de verão atualmente). Estimativa boa o suficiente.
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const off = brtOffsetMinutes(probe); // em minutos
  return new Date(probe.getTime() - off * 60000);
}

/** Calcula próxima execução com base no agendamento. */
function computeNextRun(sched: any, fromDate: Date): Date | null {
  // price_cross is event-driven: check frequently (every minute)
  if (sched.kind === "price_cross") {
    return new Date(fromDate.getTime() + 60 * 1000);
  }

  const weekdays: number[] = (sched.weekdays?.length ? sched.weekdays : [0, 1, 2, 3, 4, 5, 6]);

  if (sched.mode === "interval") {
    const hours = Math.max(1, Number(sched.interval_hours) || 1);
    const base = sched.last_sent_at ? new Date(sched.last_sent_at) : fromDate;
    let next = new Date(base.getTime() + hours * 3600 * 1000);
    if (next < fromDate) next = new Date(fromDate.getTime() + 60 * 1000);
    // Ajusta para próximo dia da semana válido em BRT
    for (let i = 0; i < 8; i++) {
      const p = brtNowParts(next);
      if (weekdays.includes(p.weekday)) return next;
      next = new Date(next.getTime() + 24 * 3600 * 1000);
    }
    return next;
  }

  // mode === "daily"
  const times: string[] = (sched.daily_times ?? []).filter((t: string) => /^\d{2}:\d{2}$/.test(t));
  if (times.length === 0) return null;

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const probe = new Date(fromDate.getTime() + dayOffset * 24 * 3600 * 1000);
    const p = brtNowParts(probe);
    if (!weekdays.includes(p.weekday)) continue;
    for (const t of times.sort()) {
      const [hh, mm] = t.split(":").map(Number);
      const candidate = brtToUTC(p.year, p.month, p.day, hh, mm);
      if (candidate > fromDate) return candidate;
    }
  }
  return null;
}

async function buildMessage(admin: any, sched: any): Promise<string | null> {
  const t = await getPortfolio(admin, sched.user_id);

  if (sched.kind === "patrimony") {
    const pct = t.totalInvested > 0 ? ((t.diff / t.totalInvested) * 100) : 0;
    const sign = t.diff >= 0 ? "📈" : "📉";
    // Variação do dia: comparar com snapshot mais recente anterior a hoje (BRT)
    const today = new Date().toLocaleDateString("en-CA", { timeZone: BRT_TZ });
    const { data: prevSnap } = await admin
      .from("portfolio_snapshots")
      .select("total_current, snapshot_date")
      .eq("user_id", sched.user_id)
      .lt("snapshot_date", today)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    let dayLine = "";
    if (prevSnap) {
      const prev = Number(prevSnap.total_current);
      const dayDiff = t.totalCurrent - prev;
      const dayPct = prev > 0 ? (dayDiff / prev) * 100 : 0;
      const dSign = dayDiff >= 0 ? "🟢" : "🔴";
      dayLine = `\n${dSign} Variação do dia: ${dayDiff >= 0 ? "+" : ""}${fmtBRL(dayDiff)} (${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(2)}%)`;
    }
    return `<b>💰 Patrimônio</b>\n\n` +
      `Atual: <b>${fmtBRL(t.totalCurrent)}</b>\n` +
      `Investido: ${fmtBRL(t.totalInvested)}\n` +
      `${sign} Resultado total: ${fmtBRL(t.diff)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)` +
      dayLine;
  }

  if (sched.kind === "dividends_month") {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: BRT_TZ, year: "numeric", month: "2-digit" });
    const parts = fmt.formatToParts(new Date());
    const year = Number(parts.find(p => p.type === "year")!.value);
    const month = Number(parts.find(p => p.type === "month")!.value);
    const [{ data: divs }, { data: settings }] = await Promise.all([
      admin.from("dividends").select("amount, ticker").eq("user_id", sched.user_id).eq("year", year).eq("month", month),
      admin.from("user_settings").select("monthly_dividend_goal").eq("user_id", sched.user_id).maybeSingle(),
    ]);
    const total = (divs ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);
    const goal = Number(settings?.monthly_dividend_goal ?? 0);
    const pct = goal > 0 ? ((total / goal) * 100) : null;
    const count = (divs ?? []).length;
    return `<b>💵 Dividendos ${String(month).padStart(2, "0")}/${year}</b>\n\n` +
      `Recebido: <b>${fmtBRL(total)}</b> em ${count} pagamento(s)\n` +
      (goal > 0 ? `Meta: ${fmtBRL(goal)}\nProgresso: ${pct!.toFixed(1)}%` : `Defina uma meta mensal no app.`);
  }

  if (sched.kind === "top_movers") {
    if (t.list.length === 0) return `📊 Sem ativos para calcular movimentações.`;
    const sorted = [...t.list].sort((a, b) => b.variation - a.variation);
    const tops = sorted.slice(0, 3);
    const bots = sorted.slice(-3).reverse();
    const fmtRow = (a: any, i: number) =>
      `${i + 1}. <b>${a.ticker}</b> ${a.variation >= 0 ? "+" : ""}${a.variation.toFixed(2)}%`;
    return `<b>📊 Movimentações</b>\n\n` +
      `🚀 Maiores altas\n${tops.map(fmtRow).join("\n")}\n\n` +
      `📉 Maiores baixas\n${bots.map(fmtRow).join("\n")}`;
  }

  if (sched.kind === "price_cross") {
    const cfg = sched.config ?? {};
    const ticker = String(cfg.ticker ?? "").toUpperCase().trim();
    const threshold = Number(cfg.threshold_price);
    const direction = (cfg.direction === "below" ? "below" : "above") as "above" | "below";
    if (!ticker || !Number.isFinite(threshold) || threshold <= 0) {
      return null;
    }
    const { data: asset } = await admin
      .from("assets")
      .select("ticker, current_price")
      .eq("user_id", sched.user_id)
      .eq("ticker", ticker)
      .maybeSingle();
    if (!asset) return null;
    const price = Number(asset.current_price);
    if (!Number.isFinite(price) || price <= 0) return null;

    const currentSide: "above" | "below" = price >= threshold ? "above" : "below";
    const prevSide: "above" | "below" | null = (sched.state?.last_side === "above" || sched.state?.last_side === "below")
      ? sched.state.last_side : null;

    // Sempre atualiza o state, mesmo sem disparo
    await admin.from("telegram_schedules").update({
      state: { last_price: price, last_side: currentSide, last_check_at: new Date().toISOString() },
    }).eq("id", sched.id);

    // Dispara somente quando cruza na direção configurada
    const triggered =
      prevSide !== null &&
      prevSide !== currentSide &&
      currentSide === direction;

    if (!triggered) return null;

    const arrow = direction === "above" ? "🟢⬆️" : "🔴⬇️";
    const word = direction === "above" ? "subiu acima de" : "caiu abaixo de";
    return `<b>${arrow} ${escapeHtml(ticker)}</b>\n\n` +
      `Preço atual: <b>${fmtBRL(price)}</b>\n` +
      `${word} <b>${fmtBRL(threshold)}</b>`;
  }

  if (sched.kind === "radar") {
    return await buildRadarMessage(admin, sched.user_id);
  }

  return `Tipo de alerta desconhecido: ${sched.kind}`;
}

/**
 * Modo Radar — varre a carteira procurando:
 *   1) Oportunidades fortes  → bom valuation + bom yield + preço ≤ PM
 *   2) Cortes relevantes     → score ruim em ativos com posição significativa
 *   3) Quedas anormais       → ativo cuja cotação caiu >X% no dia (vs último snapshot)
 * Só envia mensagem se houver pelo menos 1 item em qualquer bucket.
 */
async function buildRadarMessage(admin: any, userId: string): Promise<string | null> {
  const ABNORMAL_DROP_PCT = 3;          // % no dia
  const STRONG_DY_MONTHLY = 0.7;        // %
  const STRONG_PVP_MAX = 1.05;
  const CUT_PVP_HIGH = 1.4;
  const CUT_DY_LOW = 0.2;               // %
  const CUT_LOSS_PCT = 15;              // perda > 15%
  const MIN_PROPORTION = 3;             // % da carteira

  const [assets, txs] = await Promise.all([
    fetchAllPaginated<any>(admin, "assets",
      "ticker, quantity, current_price, average_price, total_invested, dividend_yield, pvp",
      (q) => q.eq("user_id", userId)),
    fetchAllPaginated<any>(admin, "transactions",
      "ticker, type, quantity, price, other_costs, date",
      (q) => q.eq("user_id", userId)),
  ]);

  const txByTicker = new Map<string, any[]>();
  for (const t of txs) {
    if (!txByTicker.has(t.ticker)) txByTicker.set(t.ticker, []);
    txByTicker.get(t.ticker)!.push(t);
  }

  // Total atual da carteira
  let totalCurrent = 0;
  const enriched: any[] = [];
  for (const a of assets) {
    const tlist = txByTicker.get(a.ticker) ?? [];
    const { qty, cost } = applyTx(a.quantity, a.total_invested, tlist);
    if (qty <= 0) continue;
    const cur = qty * Number(a.current_price);
    totalCurrent += cur;
    enriched.push({
      ticker: a.ticker,
      qty,
      cost,
      currentPrice: Number(a.current_price),
      averagePrice: Number(a.average_price),
      dy: Number(a.dividend_yield),
      pvp: Number(a.pvp),
      totalCurrent: cur,
    });
  }
  for (const e of enriched) {
    e.proportion = totalCurrent > 0 ? (e.totalCurrent / totalCurrent) * 100 : 0;
    e.dyMonthlyPct = e.currentPrice > 0 ? (e.dy / e.currentPrice) * 100 : 0;
    e.unrealizedPct = e.cost > 0 ? ((e.totalCurrent - e.cost) / e.cost) * 100 : 0;
    e.priceVsPm = e.averagePrice > 0 ? ((e.currentPrice - e.averagePrice) / e.averagePrice) * 100 : 0;
  }

  // Snapshot do dia anterior — para detectar queda diária anormal
  const today = new Date().toLocaleDateString("en-CA", { timeZone: BRT_TZ });
  // Placeholder map (não temos snapshot por ativo). Usamos proxy: variação acumulada vs PM.
  // Quando a queda diária real estiver disponível, basta plugar aqui.

  // Buckets
  const opportunities = enriched.filter((e) =>
    e.pvp > 0 && e.pvp <= STRONG_PVP_MAX &&
    e.dyMonthlyPct >= STRONG_DY_MONTHLY &&
    e.currentPrice <= e.averagePrice * 1.02
  ).sort((a, b) => b.dyMonthlyPct - a.dyMonthlyPct).slice(0, 5);

  const cuts = enriched.filter((e) =>
    e.proportion >= MIN_PROPORTION &&
    (
      (e.pvp > 0 && e.pvp >= CUT_PVP_HIGH) ||
      (e.dyMonthlyPct > 0 && e.dyMonthlyPct < CUT_DY_LOW) ||
      e.unrealizedPct <= -CUT_LOSS_PCT
    )
  ).sort((a, b) => a.unrealizedPct - b.unrealizedPct).slice(0, 5);

  const drops = enriched.filter((e) =>
    e.priceVsPm <= -ABNORMAL_DROP_PCT && e.proportion >= 1
  ).sort((a, b) => a.priceVsPm - b.priceVsPm).slice(0, 5);

  if (opportunities.length === 0 && cuts.length === 0 && drops.length === 0) {
    return null; // Radar silencioso quando nada relevante
  }

  const parts: string[] = ["<b>📡 Radar da Carteira</b>"];

  if (opportunities.length > 0) {
    parts.push(
      `\n<b>🟢 Oportunidades fortes</b>\n` +
      opportunities.map((e) =>
        `• <b>${escapeHtml(e.ticker)}</b> — DY ${e.dyMonthlyPct.toFixed(2)}%/mês · P/VP ${e.pvp.toFixed(2)} · ${fmtBRL(e.currentPrice)}`
      ).join("\n")
    );
  }
  if (cuts.length > 0) {
    parts.push(
      `\n<b>⚠️ Cortes relevantes</b>\n` +
      cuts.map((e) => {
        const reasons: string[] = [];
        if (e.pvp >= CUT_PVP_HIGH) reasons.push(`P/VP ${e.pvp.toFixed(2)}`);
        if (e.dyMonthlyPct > 0 && e.dyMonthlyPct < CUT_DY_LOW) reasons.push(`DY ${e.dyMonthlyPct.toFixed(2)}%/mês`);
        if (e.unrealizedPct <= -CUT_LOSS_PCT) reasons.push(`prejuízo ${e.unrealizedPct.toFixed(1)}%`);
        return `• <b>${escapeHtml(e.ticker)}</b> (${e.proportion.toFixed(1)}% carteira) — ${reasons.join(" · ")}`;
      }).join("\n")
    );
  }
  if (drops.length > 0) {
    parts.push(
      `\n<b>🔴 Quedas anormais (vs PM)</b>\n` +
      drops.map((e) =>
        `• <b>${escapeHtml(e.ticker)}</b> ${e.priceVsPm.toFixed(2)}% · ${fmtBRL(e.currentPrice)}`
      ).join("\n")
    );
  }

  return parts.join("\n");
}

async function processSchedule(admin: any, sched: any, now: Date) {
  try {
    const text = await buildMessage(admin, sched);
    // Sempre reagenda
    const next = computeNextRun({ ...sched, last_sent_at: text ? now.toISOString() : sched.last_sent_at }, now);
    const update: any = { next_run_at: next ? next.toISOString() : null };
    if (text) update.last_sent_at = now.toISOString();
    await admin.from("telegram_schedules").update(update).eq("id", sched.id);

    if (text) {
      await admin.from("telegram_outbox").insert({
        user_id: sched.user_id,
        chat_id: sched.chat_id,
        text,
        parse_mode: "HTML",
        status: "pending",
      });
    }
    return { ok: true, id: sched.id, sent: !!text };
  } catch (e) {
    console.error("processSchedule error", sched.id, e);
    return { ok: false, id: sched.id, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch {}

    const now = new Date();

    // Modo "test now": força envio de um schedule específico
    if (body?.schedule_id && body?.test === true) {
      const { data: s, error } = await admin
        .from("telegram_schedules").select("*").eq("id", body.schedule_id).single();
      if (error || !s) return new Response(JSON.stringify({ error: "schedule not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      let text = await buildMessage(admin, s);
      if (!text && s.kind === "price_cross") {
        // Para teste, força mensagem informativa do estado atual
        const cfg = s.config ?? {};
        const { data: asset } = await admin
          .from("assets").select("current_price").eq("user_id", s.user_id).eq("ticker", String(cfg.ticker ?? "").toUpperCase()).maybeSingle();
        const price = Number(asset?.current_price ?? 0);
        text = `<b>🧪 Teste — ${escapeHtml(String(cfg.ticker ?? ""))}</b>\n\n` +
          `Preço atual: <b>${fmtBRL(price)}</b>\n` +
          `Alvo: ${cfg.direction === "below" ? "abaixo de" : "acima de"} <b>${fmtBRL(Number(cfg.threshold_price ?? 0))}</b>\n` +
          `<i>O alerta dispara apenas quando o preço cruza o alvo.</i>`;
      }
      if (!text) {
        return new Response(JSON.stringify({ ok: false, reason: "no message produced" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("telegram_outbox").insert({
        user_id: s.user_id, chat_id: s.chat_id, text, parse_mode: "HTML", status: "pending",
      });
      // dispara envio imediato
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/telegram-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: "{}",
      }).catch(() => {});
      return new Response(JSON.stringify({ ok: true, queued: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inicializa next_run_at de schedules sem ele
    const { data: missing } = await admin
      .from("telegram_schedules")
      .select("*")
      .eq("enabled", true)
      .is("next_run_at", null);
    for (const s of missing ?? []) {
      const next = computeNextRun(s, now);
      if (next) {
        await admin.from("telegram_schedules").update({ next_run_at: next.toISOString() }).eq("id", s.id);
      }
    }

    // Busca schedules devidos
    const { data: due, error } = await admin
      .from("telegram_schedules")
      .select("*")
      .eq("enabled", true)
      .lte("next_run_at", now.toISOString())
      .limit(100);
    if (error) throw error;

    const results: any[] = [];
    for (const s of due ?? []) {
      results.push(await processSchedule(admin, s, now));
    }

    // Drena outbox
    if (results.length > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        await fetch(`${supabaseUrl}/functions/v1/telegram-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
      } catch (_) {}
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-scheduler error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});