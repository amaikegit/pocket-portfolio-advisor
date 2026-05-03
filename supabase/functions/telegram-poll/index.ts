import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

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

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendMessage(chatId: number, text: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
  await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
    }),
  });
}

// Mirror frontend applyTransactions
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

async function getPortfolioTotals(admin: any, userId: string) {
  const [assets, txs] = await Promise.all([
    fetchAllPaginated<any>(admin, "assets", "ticker, quantity, current_price, average_price, total_invested, dividend_yield, pvp",
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
  const list: {
    ticker: string; totalCurrent: number; variation: number;
    currentPrice: number; averagePrice: number; difference: number;
    totalInvested: number; dividendYield: number; pvp: number;
  }[] = [];
  for (const a of assets) {
    const tlist = txByTicker.get(a.ticker) ?? [];
    const { qty, cost } = applyTx(a.quantity, a.total_invested, tlist);
    if (qty <= 0) continue;
    const currentPrice = Number(a.current_price);
    const cur = qty * currentPrice;
    totalCurrent += cur;
    totalInvested += cost;
    const variation = cost > 0 ? ((cur - cost) / cost) * 100 : 0;
    const averagePrice = qty > 0 ? cost / qty : 0;
    list.push({
      ticker: a.ticker, totalCurrent: cur, variation,
      currentPrice, averagePrice,
      difference: cur - cost,
      totalInvested: cost,
      dividendYield: Number(a.dividend_yield) || 0,
      pvp: Number(a.pvp) || 0,
    });
  }
  return { totalCurrent, totalInvested, diff: totalCurrent - totalInvested, list };
}

// ====== Rating (mirror src/lib/rating.ts defaults) ======
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function ratingStarsFor(item: any, portfolioProportion: number, dividendMonthsLast12: number): number {
  const t = {
    valuation: { excellent: 0.85, good: 1.0, fair: 1.1 },
    dividendYield: { excellent: 1.0, good: 0.7, fair: 0.4 },
    priceVsAverage: { excellent: -5, good: 0, fair: 10 },
    concentration: { idealMin: 5, idealMax: 15, highMax: 25, lowMin: 2 },
    dividendConsistency: { excellent: 10, good: 6, fair: 1 },
  };
  const w = { valuation: 25, dividendYield: 25, priceVsAverage: 15, unrealizedPnL: 15, concentration: 10, dividendConsistency: 10 };

  const monthlyProfitability = item.currentPrice > 0 ? (item.dividendYield / item.currentPrice) * 100 : 0;
  const priceVar = item.currentPrice - item.averagePrice;

  // valuation
  let sValuation = 0.5;
  if (item.pvp > 0) {
    if (item.pvp < t.valuation.excellent) sValuation = 1.0;
    else if (item.pvp < t.valuation.good) sValuation = 0.7;
    else if (item.pvp < t.valuation.fair) sValuation = 0.4;
    else sValuation = 0.1;
  }
  // dy
  let sDY = 0.1;
  if (monthlyProfitability > t.dividendYield.excellent) sDY = 1.0;
  else if (monthlyProfitability > t.dividendYield.good) sDY = 0.7;
  else if (monthlyProfitability > t.dividendYield.fair) sDY = 0.4;
  // price vs average
  let sPVA = 0.5;
  if (item.averagePrice > 0) {
    const pct = (priceVar / item.averagePrice) * 100;
    if (pct < t.priceVsAverage.excellent) sPVA = 1.0;
    else if (pct < t.priceVsAverage.good) sPVA = 0.7;
    else if (pct < t.priceVsAverage.fair) sPVA = 0.5;
    else sPVA = 0.3;
  }
  // pnl
  let sPNL = 0.5;
  if (item.totalInvested > 0) {
    const pct = (item.difference / item.totalInvested) * 100;
    sPNL = clamp(0.5 + pct / 100, 0, 1);
  }
  // concentration
  const prop = portfolioProportion;
  let sConc: number;
  if (prop >= t.concentration.idealMin && prop <= t.concentration.idealMax) sConc = 1.0;
  else if (prop > t.concentration.idealMax && prop <= t.concentration.highMax) sConc = 0.6;
  else if (prop > t.concentration.highMax) sConc = 0.2;
  else if (prop < t.concentration.lowMin) sConc = 0.5;
  else sConc = 0.7;
  // dividend consistency
  const m = dividendMonthsLast12;
  let sCons: number;
  if (m >= t.dividendConsistency.excellent) sCons = 1.0;
  else if (m >= t.dividendConsistency.good) sCons = 0.6;
  else if (m >= t.dividendConsistency.fair) sCons = 0.3;
  else sCons = 0;

  const total =
    sValuation * w.valuation +
    sDY * w.dividendYield +
    sPVA * w.priceVsAverage +
    sPNL * w.unrealizedPnL +
    sConc * w.concentration +
    sCons * w.dividendConsistency;
  return clamp(Math.round(total / 20), 1, 5);
}

function nowBRTMonthYear() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const year = Number(parts.find(p => p.type === "year")!.value);
  const month = Number(parts.find(p => p.type === "month")!.value);
  return { year, month };
}

async function handleCommand(admin: any, chatId: number, fromUser: any, text: string) {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  const cmdRaw = parts[0].toLowerCase();
  const cmd = cmdRaw.split("@")[0]; // strip @botname
  const arg = parts[1];

  // Find link
  const { data: link } = await admin
    .from("telegram_links").select("*").eq("chat_id", chatId).maybeSingle();

  if (cmd === "/start" || cmd === "/vincular") {
    if (link) {
      await sendMessage(chatId, `✅ Este chat já está vinculado.\nUse /ajuda para ver os comandos.`);
      return;
    }
    if (!arg) {
      await sendMessage(chatId,
        `👋 Olá! Para vincular este chat à sua conta, gere um código no app (Configurações → Telegram) e envie:\n\n<code>/start SEUCODIGO</code>`);
      return;
    }
    const code = arg.trim();
    const { data: codeRow } = await admin
      .from("telegram_link_codes").select("*").eq("code", code).is("used_at", null).maybeSingle();
    if (!codeRow) {
      await sendMessage(chatId, `❌ Código inválido ou já usado.`);
      return;
    }
    if (new Date(codeRow.expires_at) < new Date()) {
      await sendMessage(chatId, `⏱️ Código expirado. Gere um novo no app.`);
      return;
    }
    // Check if user already linked to another chat
    const { data: existing } = await admin
      .from("telegram_links").select("chat_id").eq("user_id", codeRow.user_id).maybeSingle();
    if (existing) {
      await admin.from("telegram_links").update({
        chat_id: chatId,
        username: fromUser?.username ?? null,
        first_name: fromUser?.first_name ?? null,
      }).eq("user_id", codeRow.user_id);
    } else {
      await admin.from("telegram_links").insert({
        user_id: codeRow.user_id,
        chat_id: chatId,
        username: fromUser?.username ?? null,
        first_name: fromUser?.first_name ?? null,
      });
    }
    await admin.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("id", codeRow.id);
    await sendMessage(chatId,
      `🎉 Conta vinculada com sucesso!\n\nVocê receberá alertas e relatórios automaticamente. Use /ajuda para ver todos os comandos.`);
    return;
  }

  if (cmd === "/ajuda" || cmd === "/help") {
    await sendMessage(chatId,
      `<b>Comandos disponíveis</b>\n\n` +
      `/patrimonio — saldo total e variação\n` +
      `/dividendos — recebidos no mês + meta\n` +
      `/alertas — últimos alertas não lidos\n` +
      `/top — 5 melhores ativos (rating ⭐ + valor)\n` +
      `/piores — 5 ativos com pior variação\n` +
      `/relatorio — gera relatório de IA agora\n` +
      `/desvincular — remove vínculo deste chat\n` +
      `/ajuda — esta mensagem`);
    return;
  }

  if (!link) {
    await sendMessage(chatId,
      `🔒 Este chat não está vinculado.\nGere um código no app (Configurações → Telegram) e envie:\n<code>/start SEUCODIGO</code>`);
    return;
  }

  if (cmd === "/desvincular") {
    await admin.from("telegram_links").delete().eq("chat_id", chatId);
    await sendMessage(chatId, `🔌 Desvinculado. Até a próxima!`);
    return;
  }

  if (cmd === "/patrimonio") {
    const t = await getPortfolioTotals(admin, link.user_id);
    const pct = t.totalInvested > 0 ? ((t.diff / t.totalInvested) * 100).toFixed(2) : "0.00";
    const sign = t.diff >= 0 ? "📈" : "📉";
    await sendMessage(chatId,
      `<b>💰 Patrimônio Total</b>\n\n` +
      `Atual: <b>${fmtBRL(t.totalCurrent)}</b>\n` +
      `Investido: ${fmtBRL(t.totalInvested)}\n` +
      `${sign} Resultado: ${fmtBRL(t.diff)} (${pct}%)\n` +
      `Ativos: ${t.list.length}`);
    return;
  }

  if (cmd === "/dividendos") {
    const { year, month } = nowBRTMonthYear();
    const [{ data: divs }, { data: settings }] = await Promise.all([
      admin.from("dividends").select("amount").eq("user_id", link.user_id).eq("year", year).eq("month", month),
      admin.from("user_settings").select("monthly_dividend_goal").eq("user_id", link.user_id).maybeSingle(),
    ]);
    const total = (divs ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);
    const goal = Number(settings?.monthly_dividend_goal ?? 0);
    const pct = goal > 0 ? ((total / goal) * 100).toFixed(1) : null;
    await sendMessage(chatId,
      `<b>💵 Dividendos ${String(month).padStart(2, "0")}/${year}</b>\n\n` +
      `Recebido: <b>${fmtBRL(total)}</b>\n` +
      (goal > 0 ? `Meta: ${fmtBRL(goal)}\nProgresso: ${pct}%` : `Defina uma meta mensal no app.`));
    return;
  }

  if (cmd === "/alertas") {
    const { data: alerts } = await admin.from("alerts")
      .select("title, message, ticker, severity, created_at")
      .eq("user_id", link.user_id).eq("read", false)
      .order("created_at", { ascending: false }).limit(10);
    if (!alerts || alerts.length === 0) {
      await sendMessage(chatId, `✅ Nenhum alerta não lido.`);
      return;
    }
    const lines = alerts.map((a: any) => {
      const icon = a.severity === "warning" ? "⚠️" : a.severity === "success" ? "✅" : "ℹ️";
      const tk = a.ticker ? ` [${a.ticker}]` : "";
      return `${icon} <b>${escapeHtml(a.title)}</b>${tk}\n${escapeHtml(a.message)}`;
    });
    await sendMessage(chatId, `<b>🔔 Alertas não lidos (${alerts.length})</b>\n\n${lines.join("\n\n")}`);
    return;
  }

  if (cmd === "/top" || cmd === "/piores") {
    const t = await getPortfolioTotals(admin, link.user_id);
    if (t.list.length === 0) {
      await sendMessage(chatId, `📊 Sem ativos para classificar.`);
      return;
    }

    if (cmd === "/top") {
      // Buscar meses com proventos nos últimos 12 meses por ticker
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      const sinceYear = since.getFullYear();
      const sinceMonth = since.getMonth() + 1;
      const { data: divs } = await admin
        .from("dividends")
        .select("ticker, year, month")
        .eq("user_id", link.user_id)
        .or(`year.gt.${sinceYear},and(year.eq.${sinceYear},month.gte.${sinceMonth})`);
      const monthsByTicker = new Map<string, Set<string>>();
      for (const d of divs ?? []) {
        const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
        if (!monthsByTicker.has(d.ticker)) monthsByTicker.set(d.ticker, new Set());
        monthsByTicker.get(d.ticker)!.add(key);
      }

      const enriched = t.list.map(a => {
        const prop = t.totalCurrent > 0 ? (a.totalCurrent / t.totalCurrent) * 100 : 0;
        const months = Math.min(12, monthsByTicker.get(a.ticker)?.size ?? 0);
        const stars = ratingStarsFor(a, prop, months);
        return { ...a, stars, prop };
      });
      enriched.sort((x, y) => (y.stars - x.stars) || (y.totalCurrent - x.totalCurrent));
      const picks = enriched.slice(0, 5);
      const lines = picks.map((a, i) => {
        const stars = "⭐".repeat(a.stars) + "·".repeat(5 - a.stars);
        return `${i + 1}. <b>${a.ticker}</b> ${stars}\n` +
          `   ${fmtBRL(a.totalCurrent)} · ${a.variation >= 0 ? "+" : ""}${a.variation.toFixed(2)}%`;
      });
      await sendMessage(chatId,
        `<b>🏆 Top 5 da carteira</b>\n` +
        `<i>Ranking por nota de 5 estrelas + valor atual</i>\n\n${lines.join("\n")}`);
    } else {
      const sorted = [...t.list].sort((a, b) => a.variation - b.variation);
      const picks = sorted.slice(0, 5);
      const lines = picks.map((a, i) =>
        `${i + 1}. <b>${a.ticker}</b> — ${a.variation >= 0 ? "+" : ""}${a.variation.toFixed(2)}% (${fmtBRL(a.totalCurrent)})`
      );
      await sendMessage(chatId, `<b>📉 Piores 5 ativos</b>\n\n${lines.join("\n")}`);
    }
    return;
  }

  if (cmd === "/relatorio") {
    await sendMessage(chatId, `⏳ Gerando relatório de IA... Isso pode levar até 1 minuto.`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl}/functions/v1/weekly-ai-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ user_id: link.user_id, report_type: "on_demand" }),
    }).then(async (r) => {
      if (!r.ok) {
        await sendMessage(chatId, `❌ Falha ao gerar relatório.`);
      }
      // weekly-ai-report enqueues a Telegram message itself
    }).catch(async () => {
      await sendMessage(chatId, `❌ Erro ao chamar gerador de relatório.`);
    });
    return;
  }

  await sendMessage(chatId, `❓ Comando não reconhecido. Envie /ajuda para ver os comandos.`);
}

serve(async () => {
  const startTime = Date.now();
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500 });
  if (!TELEGRAM_API_KEY) return new Response(JSON.stringify({ error: "TELEGRAM_API_KEY missing" }), { status: 500 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: state, error: stateErr } = await admin
    .from("telegram_bot_state").select("update_offset").eq("id", 1).single();
  if (stateErr) return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });

  let currentOffset: number = state.update_offset;
  let totalProcessed = 0;

  while (true) {
    const remaining = MAX_RUNTIME_MS - (Date.now() - startTime);
    if (remaining < MIN_REMAINING_MS) break;
    const timeout = Math.min(50, Math.floor(remaining / 1000) - 5);
    if (timeout < 1) break;

    const r = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ offset: currentOffset, timeout, allowed_updates: ["message"] }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      console.error("getUpdates error", data);
      break;
    }
    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      const msg = u.message;
      if (msg?.text) {
        try {
          await handleCommand(admin, msg.chat.id, msg.from, msg.text);
          totalProcessed++;
        } catch (e) {
          console.error("handleCommand error", e);
        }
      }
    }
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await admin.from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);
    currentOffset = newOffset;
  }

  // Drain outbox at end of cycle
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${supabaseUrl}/functions/v1/telegram-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: "{}",
    });
  } catch (_) { /* ignore */ }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});