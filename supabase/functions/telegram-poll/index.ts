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
      `/top — 5 ativos com melhor variação\n` +
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
    const sorted = [...t.list].sort((a, b) => b.variation - a.variation);
    const picks = cmd === "/top" ? sorted.slice(0, 5) : sorted.slice(-5).reverse();
    const title = cmd === "/top" ? "🚀 Top 5 ativos" : "📉 Piores 5 ativos";
    const lines = picks.map((a, i) =>
      `${i + 1}. <b>${a.ticker}</b> — ${a.variation >= 0 ? "+" : ""}${a.variation.toFixed(2)}% (${fmtBRL(a.totalCurrent)})`
    );
    await sendMessage(chatId, `<b>${title}</b>\n\n${lines.join("\n")}`);
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