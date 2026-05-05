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

async function sendMessage(chatId: number, text: string, replyMarkup?: any, replyToMessageId?: number): Promise<number | undefined> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
  const body: any = {
    chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
  const r = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  try {
    const j = await r.json();
    return j?.result?.message_id;
  } catch { return undefined; }
}

async function answerCallbackQuery(callbackId: string, text?: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
  await fetch(`${GATEWAY_URL}/answerCallbackQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ callback_query_id: callbackId, text: text ?? "" }),
  });
}

const MAIN_MENU_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "💰 Patrimônio", callback_data: "cmd:patrimonio" },
      { text: "💵 Dividendos", callback_data: "cmd:dividendos" },
    ],
    [
      { text: "🏆 Top 5", callback_data: "cmd:top" },
      { text: "📉 Piores 5", callback_data: "cmd:piores" },
    ],
    [
      { text: "➕ Lançar dividendo", callback_data: "flow:dividendo" },
    ],
    [
      { text: "🟢 Registrar compra", callback_data: "flow:compra" },
      { text: "🔴 Registrar venda", callback_data: "flow:venda" },
    ],
    [
      { text: "🔔 Alertas", callback_data: "cmd:alertas" },
      { text: "📄 Relatório IA", callback_data: "cmd:relatorio" },
    ],
  ],
};

const CANCEL_KEYBOARD = {
  inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "flow:cancel" }]],
};

// ForceReply faz o cliente Telegram abrir o teclado já em modo "responder"
// à mensagem do bot. Isso garante que, mesmo em grupos com Privacy Mode
// ATIVO, a resposta do usuário seja entregue ao bot (porque é um reply).
const FORCE_REPLY = { force_reply: true, selective: true } as const;

function confirmKeyboard() {
  return {
    inline_keyboard: [[
      { text: "✅ Confirmar", callback_data: "flow:confirm" },
      { text: "❌ Cancelar", callback_data: "flow:cancel" },
    ]],
  };
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

// Parse number that may use BRL ("1.234,56") or US ("1234.56") format
function parseNum(s: string): number | null {
  if (!s) return null;
  let str = s.trim().replace(/[R$\s]/gi, "");
  if (str.includes(",") && str.includes(".")) {
    // assume "1.234,56" → remove thousand dots, then comma→dot
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

// Parse date "DD/MM/AAAA" or "AAAA-MM-DD" or "DD/MM" (current year). Returns BRT-local YYYY-MM-DD.
function parseDateBRT(s?: string): { ymd: string; year: number; month: number } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!s) {
    const [y, m] = today.split("-");
    return { ymd: today, year: Number(y), month: Number(m) };
  }
  let y: number, mo: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    [y, mo, d] = s.split("-").map(Number);
  } else {
    const parts = s.split("/").map(Number);
    if (parts.length === 3) { d = parts[0]; mo = parts[1]; y = parts[2]; }
    else if (parts.length === 2) { d = parts[0]; mo = parts[1]; y = Number(today.split("-")[0]); }
    else throw new Error("Data inválida");
  }
  if (!y || !mo || !d) throw new Error("Data inválida");
  const ymd = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { ymd, year: y, month: mo };
}

function detectAssetType(ticker: string): string {
  const t = ticker.toUpperCase();
  if (/11$/.test(t)) return "fiis";
  if (/34$/.test(t) || /35$/.test(t)) return "bdrs";
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return "acoes";
  return "acoes";
}

// ===== Helpers para commit (compartilhados entre comandos texto e fluxos por botão) =====
async function commitDividend(admin: any, userId: number | string, ticker: string, amount: number, dateInfo: { ymd: string; year: number; month: number }) {
  const { error } = await admin.from("dividends").insert({
    user_id: userId, ticker, amount,
    year: dateInfo.year, month: dateInfo.month, payment_date: dateInfo.ymd,
  });
  if (error) throw error;
  const { data: monthDivs } = await admin.from("dividends")
    .select("amount").eq("user_id", userId)
    .eq("year", dateInfo.year).eq("month", dateInfo.month);
  return (monthDivs ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);
}

async function commitTransaction(
  admin: any, userId: string, type: "buy" | "sell",
  ticker: string, qty: number, price: number, costs: number,
  dateInfo: { ymd: string; year: number; month: number },
) {
  const { data: existingAsset } = await admin
    .from("assets").select("ticker").eq("user_id", userId).eq("ticker", ticker).maybeSingle();
  const assetType = detectAssetType(ticker);
  const total = type === "buy" ? qty * price + costs : qty * price - costs;
  const { error } = await admin.from("transactions").insert({
    user_id: userId, type, asset_type: assetType, ticker,
    date: dateInfo.ymd, quantity: qty, price, other_costs: costs, total,
  });
  if (error) throw error;
  if (type === "buy" && !existingAsset) {
    await admin.from("assets").insert({
      user_id: userId, ticker, quantity: 0, current_price: price,
      average_price: 0, total_invested: 0, dividend_yield: 0, pvp: 0, is_manual_price: true,
    });
  }
  return { assetType, total, isNewAsset: !existingAsset };
}

// ===== Sessão do fluxo interativo =====
async function getSession(admin: any, chatId: number) {
  const { data } = await admin.from("telegram_sessions").select("*").eq("chat_id", chatId).maybeSingle();
  return data;
}
async function setSession(admin: any, userId: string, chatId: number, flow: string, step: string, data: any) {
  await admin.from("telegram_sessions").upsert({
    user_id: userId, chat_id: chatId, flow, step, data,
    updated_at: new Date().toISOString(),
  }, { onConflict: "chat_id" });
}
async function clearSession(admin: any, chatId: number) {
  await admin.from("telegram_sessions").delete().eq("chat_id", chatId);
}

async function startFlow(admin: any, userId: string, chatId: number, flow: "dividendo" | "compra" | "venda") {
  await setSession(admin, userId, chatId, flow, "ticker", {});
  const label = flow === "dividendo" ? "lançar dividendo" : flow === "compra" ? "registrar compra" : "registrar venda";
  await sendMessage(chatId,
    `📝 <b>Vamos ${label}</b>\n\nPasso 1/${flow === "dividendo" ? 3 : 5}: digite o <b>ticker</b> (ex.: MXRF11, BBAS3)`,
    CANCEL_KEYBOARD);
}

async function handleFlowMessage(admin: any, link: any, chatId: number, text: string): Promise<boolean> {
  const session = await getSession(admin, chatId);
  if (!session) return false;
  // commands cancel any flow except /cancelar handled below
  const trimmed = text.trim();
  if (trimmed.startsWith("/")) {
    if (trimmed.toLowerCase().startsWith("/cancelar")) {
      await clearSession(admin, chatId);
      await sendMessage(chatId, `❌ Operação cancelada.`);
      return true;
    }
    return false; // let normal command run; we keep session to allow continuation
  }
  const data = session.data || {};
  const flow = session.flow as "dividendo" | "compra" | "venda";

  if (session.step === "ticker") {
    const ticker = trimmed.toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{2,8}$/.test(ticker)) {
      await sendMessage(chatId, `❌ Ticker inválido. Tente novamente.`, CANCEL_KEYBOARD);
      return true;
    }
    data.ticker = ticker;
    if (flow === "dividendo") {
      await setSession(admin, link.user_id, chatId, flow, "amount", data);
      await sendMessage(chatId, `Passo 2/3: digite o <b>valor</b> recebido (ex.: 12,50)`, CANCEL_KEYBOARD);
    } else {
      await setSession(admin, link.user_id, chatId, flow, "qty", data);
      await sendMessage(chatId, `Passo 2/5: digite a <b>quantidade</b> (ex.: 10)`, CANCEL_KEYBOARD);
    }
    return true;
  }

  if (session.step === "amount") {
    const amount = parseNum(trimmed);
    if (!amount || amount <= 0) { await sendMessage(chatId, `❌ Valor inválido. Tente novamente.`, CANCEL_KEYBOARD); return true; }
    data.amount = amount;
    await setSession(admin, link.user_id, chatId, flow, "date", data);
    await sendMessage(chatId, `Passo 3/3: digite a <b>data</b> (DD/MM/AAAA) ou envie <code>hoje</code>.`, CANCEL_KEYBOARD);
    return true;
  }

  if (session.step === "qty") {
    const qty = parseNum(trimmed);
    if (!qty || qty <= 0) { await sendMessage(chatId, `❌ Quantidade inválida.`, CANCEL_KEYBOARD); return true; }
    data.qty = qty;
    await setSession(admin, link.user_id, chatId, flow, "price", data);
    await sendMessage(chatId, `Passo 3/5: digite o <b>preço unitário</b> (ex.: 28,50)`, CANCEL_KEYBOARD);
    return true;
  }

  if (session.step === "price") {
    const price = parseNum(trimmed);
    if (!price || price <= 0) { await sendMessage(chatId, `❌ Preço inválido.`, CANCEL_KEYBOARD); return true; }
    data.price = price;
    await setSession(admin, link.user_id, chatId, flow, "costs", data);
    await sendMessage(chatId, `Passo 4/5: <b>outros custos</b> (taxas)? Envie o valor ou <code>0</code>.`, CANCEL_KEYBOARD);
    return true;
  }

  if (session.step === "costs") {
    const costs = parseNum(trimmed) ?? 0;
    if (costs < 0) { await sendMessage(chatId, `❌ Valor inválido.`, CANCEL_KEYBOARD); return true; }
    data.costs = costs;
    await setSession(admin, link.user_id, chatId, flow, "date", data);
    await sendMessage(chatId, `Passo 5/5: digite a <b>data</b> (DD/MM/AAAA) ou envie <code>hoje</code>.`, CANCEL_KEYBOARD);
    return true;
  }

  if (session.step === "date") {
    let dateInfo;
    try { dateInfo = parseDateBRT(trimmed.toLowerCase() === "hoje" ? undefined : trimmed); }
    catch { await sendMessage(chatId, `❌ Data inválida. Use DD/MM/AAAA.`, CANCEL_KEYBOARD); return true; }
    data.dateInfo = dateInfo;
    await setSession(admin, link.user_id, chatId, flow, "confirm", data);
    let summary = "";
    if (flow === "dividendo") {
      summary = `<b>Confirmar dividendo</b>\n\n` +
        `Ativo: <b>${escapeHtml(data.ticker)}</b>\n` +
        `Valor: ${fmtBRL(data.amount)}\n` +
        `Data: ${dateInfo.ymd.split("-").reverse().join("/")}`;
    } else {
      const totalPrev = (data.qty * data.price) + (flow === "compra" ? data.costs : -data.costs);
      summary = `<b>Confirmar ${flow === "compra" ? "compra 🟢" : "venda 🔴"}</b>\n\n` +
        `Ativo: <b>${escapeHtml(data.ticker)}</b>\n` +
        `Qtd: ${data.qty}\n` +
        `Preço: ${fmtBRL(data.price)}\n` +
        (data.costs > 0 ? `Custos: ${fmtBRL(data.costs)}\n` : "") +
        `Total: <b>${fmtBRL(totalPrev)}</b>\n` +
        `Data: ${dateInfo.ymd.split("-").reverse().join("/")}`;
    }
    await sendMessage(chatId, summary, confirmKeyboard());
    return true;
  }

  return false;
}

async function handleFlowConfirm(admin: any, link: any, chatId: number) {
  const session = await getSession(admin, chatId);
  if (!session || session.step !== "confirm") {
    await sendMessage(chatId, `Nada para confirmar.`);
    return;
  }
  const { flow, data } = session;
  try {
    if (flow === "dividendo") {
      const total = await commitDividend(admin, link.user_id, data.ticker, data.amount, data.dateInfo);
      await clearSession(admin, chatId);
      await sendMessage(chatId,
        `✅ <b>Dividendo lançado</b>\n\n` +
        `Ativo: <b>${escapeHtml(data.ticker)}</b>\n` +
        `Valor: ${fmtBRL(data.amount)}\n` +
        `Data: ${data.dateInfo.ymd.split("-").reverse().join("/")}\n\n` +
        `Total ${String(data.dateInfo.month).padStart(2, "0")}/${data.dateInfo.year}: <b>${fmtBRL(total)}</b>`,
        MAIN_MENU_KEYBOARD);
    } else {
      const type: "buy" | "sell" = flow === "compra" ? "buy" : "sell";
      const r = await commitTransaction(admin, link.user_id, type, data.ticker, data.qty, data.price, data.costs ?? 0, data.dateInfo);
      await clearSession(admin, chatId);
      const icon = type === "buy" ? "🟢" : "🔴";
      const label = type === "buy" ? "Compra" : "Venda";
      await sendMessage(chatId,
        `${icon} <b>${label} registrada</b>\n\n` +
        `Ativo: <b>${escapeHtml(data.ticker)}</b> (${r.assetType})\n` +
        `Qtd: ${data.qty}\n` +
        `Preço: ${fmtBRL(data.price)}\n` +
        (data.costs > 0 ? `Custos: ${fmtBRL(data.costs)}\n` : "") +
        `Total: <b>${fmtBRL(r.total)}</b>\n` +
        `Data: ${data.dateInfo.ymd.split("-").reverse().join("/")}` +
        (type === "buy" && r.isNewAsset ? `\n\nℹ️ Ativo criado na carteira. Atualize cotação/DY no app.` : ""),
        MAIN_MENU_KEYBOARD);
    }
  } catch (e: any) {
    await sendMessage(chatId, `❌ Erro ao salvar: ${escapeHtml(e?.message ?? String(e))}`);
  }
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
      `/menu — abre o menu com botões 👇\n` +
      `/patrimonio — saldo total e variação\n` +
      `/dividendos — recebidos no mês + meta\n` +
      `/alertas — últimos alertas não lidos\n` +
      `/top — 5 melhores ativos (rating ⭐ + valor)\n` +
      `/piores — 5 ativos com pior variação\n` +
      `/relatorio — gera relatório de IA agora\n` +
      `/dividendo TICKER VALOR [DD/MM/AAAA] — lança um provento recebido\n` +
      `/compra TICKER QTD PRECO [CUSTOS] [DD/MM/AAAA] — registra compra\n` +
      `/venda TICKER QTD PRECO [CUSTOS] [DD/MM/AAAA] — registra venda\n` +
      `/cancelar — cancela operação em andamento\n` +
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

  if (cmd === "/menu" || cmd === "/start") {
    await sendMessage(chatId, `<b>📋 Menu principal</b>\n\nEscolha uma opção:`, MAIN_MENU_KEYBOARD);
    return;
  }

  if (cmd === "/cancelar") {
    await clearSession(admin, chatId);
    await sendMessage(chatId, `❌ Operação cancelada.`);
    return;
  }

  if (cmd === "/lancar_dividendo") { await startFlow(admin, link.user_id, chatId, "dividendo"); return; }
  if (cmd === "/lancar_compra") { await startFlow(admin, link.user_id, chatId, "compra"); return; }
  if (cmd === "/lancar_venda") { await startFlow(admin, link.user_id, chatId, "venda"); return; }

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

  if (cmd === "/dividendo" || cmd === "/dividendos_lancar" || cmd === "/prov") {
    // /dividendo TICKER VALOR [DD/MM/AAAA]
    if (parts.length < 3) {
      await sendMessage(chatId,
        `Uso: <code>/dividendo TICKER VALOR [DD/MM/AAAA]</code>\n` +
        `Ex.: <code>/dividendo MXRF11 12,50 15/04/2026</code>`);
      return;
    }
    const ticker = parts[1].toUpperCase();
    const amount = parseNum(parts[2]);
    if (amount === null || amount <= 0) {
      await sendMessage(chatId, `❌ Valor inválido: <code>${escapeHtml(parts[2])}</code>`);
      return;
    }
    let dateInfo;
    try { dateInfo = parseDateBRT(parts[3]); } catch { await sendMessage(chatId, `❌ Data inválida. Use DD/MM/AAAA.`); return; }
    const { error } = await admin.from("dividends").insert({
      user_id: link.user_id,
      ticker,
      amount,
      year: dateInfo.year,
      month: dateInfo.month,
      payment_date: dateInfo.ymd,
    });
    if (error) { await sendMessage(chatId, `❌ Erro ao lançar: ${escapeHtml(error.message)}`); return; }
    // Monthly total after insert
    const { data: monthDivs } = await admin.from("dividends")
      .select("amount").eq("user_id", link.user_id)
      .eq("year", dateInfo.year).eq("month", dateInfo.month);
    const total = (monthDivs ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);
    await sendMessage(chatId,
      `✅ <b>Dividendo lançado</b>\n\n` +
      `Ativo: <b>${escapeHtml(ticker)}</b>\n` +
      `Valor: ${fmtBRL(amount)}\n` +
      `Data: ${dateInfo.ymd.split("-").reverse().join("/")}\n\n` +
      `Total ${String(dateInfo.month).padStart(2, "0")}/${dateInfo.year}: <b>${fmtBRL(total)}</b>`);
    return;
  }

  if (cmd === "/compra" || cmd === "/venda") {
    // /compra TICKER QTD PRECO [CUSTOS] [DD/MM/AAAA]
    if (parts.length < 4) {
      await sendMessage(chatId,
        `Uso: <code>${cmd} TICKER QTD PRECO [CUSTOS] [DD/MM/AAAA]</code>\n` +
        `Ex.: <code>${cmd} BBAS3 10 28,50 5,90 03/05/2026</code>`);
      return;
    }
    const type = cmd === "/compra" ? "buy" : "sell";
    const ticker = parts[1].toUpperCase();
    const qty = parseNum(parts[2]);
    const price = parseNum(parts[3]);
    if (!qty || qty <= 0) { await sendMessage(chatId, `❌ Quantidade inválida.`); return; }
    if (!price || price <= 0) { await sendMessage(chatId, `❌ Preço inválido.`); return; }

    // Detect optional custos and date among parts[4], parts[5]
    let costs = 0;
    let dateStr: string | undefined;
    for (const p of parts.slice(4)) {
      if (/[\/\-]/.test(p)) dateStr = p;
      else {
        const n = parseNum(p);
        if (n !== null) costs = n;
      }
    }
    let dateInfo;
    try { dateInfo = parseDateBRT(dateStr); } catch { await sendMessage(chatId, `❌ Data inválida. Use DD/MM/AAAA.`); return; }

    // Look up existing asset to inherit asset_type
    const { data: existingAsset } = await admin
      .from("assets").select("ticker").eq("user_id", link.user_id).eq("ticker", ticker).maybeSingle();
    const assetType = detectAssetType(ticker);

    const total = type === "buy" ? qty * price + costs : qty * price - costs;
    const { error } = await admin.from("transactions").insert({
      user_id: link.user_id,
      type, asset_type: assetType, ticker,
      date: dateInfo.ymd,
      quantity: qty, price, other_costs: costs, total,
    });
    if (error) { await sendMessage(chatId, `❌ Erro ao registrar: ${escapeHtml(error.message)}`); return; }

    // If buying a new ticker, create asset row so it appears in the portfolio
    if (type === "buy" && !existingAsset) {
      await admin.from("assets").insert({
        user_id: link.user_id,
        ticker,
        quantity: 0,
        current_price: price,
        average_price: 0,
        total_invested: 0,
        dividend_yield: 0,
        pvp: 0,
        is_manual_price: true,
      });
    }

    const icon = type === "buy" ? "🟢" : "🔴";
    const label = type === "buy" ? "Compra" : "Venda";
    await sendMessage(chatId,
      `${icon} <b>${label} registrada</b>\n\n` +
      `Ativo: <b>${escapeHtml(ticker)}</b> (${assetType})\n` +
      `Qtd: ${qty}\n` +
      `Preço: ${fmtBRL(price)}\n` +
      (costs > 0 ? `Custos: ${fmtBRL(costs)}\n` : "") +
      `Total: <b>${fmtBRL(total)}</b>\n` +
      `Data: ${dateInfo.ymd.split("-").reverse().join("/")}` +
      (type === "buy" && !existingAsset ? `\n\nℹ️ Ativo criado na carteira. Atualize cotação/DY no app.` : ""));
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
      body: JSON.stringify({ offset: currentOffset, timeout, allowed_updates: ["message", "callback_query"] }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      console.error("getUpdates error", data);
      break;
    }
    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      try {
        if (u.callback_query) {
          const cq = u.callback_query;
          const chatId = cq.message?.chat?.id;
          const dataStr: string = cq.data ?? "";
          await answerCallbackQuery(cq.id);
          if (!chatId) continue;
          const { data: link } = await admin
            .from("telegram_links").select("*").eq("chat_id", chatId).maybeSingle();
          if (!link) {
            await sendMessage(chatId, `🔒 Vincule este chat primeiro com /start SEUCODIGO.`);
          } else if (dataStr.startsWith("cmd:")) {
            const cmd = "/" + dataStr.slice(4);
            await handleCommand(admin, chatId, cq.from, cmd);
          } else if (dataStr === "flow:dividendo") {
            await startFlow(admin, link.user_id, chatId, "dividendo");
          } else if (dataStr === "flow:compra") {
            await startFlow(admin, link.user_id, chatId, "compra");
          } else if (dataStr === "flow:venda") {
            await startFlow(admin, link.user_id, chatId, "venda");
          } else if (dataStr === "flow:cancel") {
            await clearSession(admin, chatId);
            await sendMessage(chatId, `❌ Operação cancelada.`);
          } else if (dataStr === "flow:confirm") {
            await handleFlowConfirm(admin, link, chatId);
          }
          totalProcessed++;
        } else {
          const msg = u.message;
          if (msg?.text) {
            const chatId = msg.chat.id;
            const { data: link } = await admin
              .from("telegram_links").select("*").eq("chat_id", chatId).maybeSingle();
            const handled = link ? await handleFlowMessage(admin, link, chatId, msg.text) : false;
            if (!handled) await handleCommand(admin, chatId, msg.from, msg.text);
            totalProcessed++;
          }
        }
      } catch (e) {
        console.error("update handler error", e);
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