import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

// Strip emoji / pictographic chars not supported by jsPDF default fonts.
function stripEmoji(s: string) {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ExecMetrics {
  title: string;
  dateLabel: string;
  totalCurrent: number;
  totalInvested: number;
  diff: number;
  rentPct: number;
  dividendsWeek: number;
  dividendsCount: number;
  assetsCount: number;
}

function buildExecutivePdf(metrics: ExecMetrics, markdown: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const contentW = pageW - marginX * 2;

  // Brand colors
  const accent: [number, number, number] = [16, 110, 190];
  const dark: [number, number, number] = [25, 32, 45];
  const muted: [number, number, number] = [110, 120, 135];
  const positive: [number, number, number] = [22, 140, 86];
  const negative: [number, number, number] = [196, 60, 60];

  const drawHeader = () => {
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text("RELATÓRIO EXECUTIVO • CARTEIRA", marginX, 28);
    doc.setFont("helvetica", "normal");
    doc.text(metrics.dateLabel, pageW - marginX, 28, { align: "right" });
  };

  const drawFooter = (pageNum: number, totalPages?: number) => {
    doc.setDrawColor(220, 224, 230);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageH - 32, pageW - marginX, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Gerado por IA — uso informativo, não constitui recomendação de investimento.", marginX, pageH - 18);
    const pg = totalPages ? `Página ${pageNum} de ${totalPages}` : `Página ${pageNum}`;
    doc.text(pg, pageW - marginX, pageH - 18, { align: "right" });
  };

  let y = 60;
  let pageNum = 1;
  drawHeader();

  const ensureSpace = (h: number) => {
    if (y + h > pageH - 50) {
      drawFooter(pageNum);
      doc.addPage();
      pageNum++;
      y = 60;
      drawHeader();
    }
  };

  // ===== Cover block =====
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(stripEmoji(metrics.title), contentW);
  doc.text(titleLines, marginX, (y += 10));
  y += titleLines.length * 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...muted);
  doc.text("Visão consolidada da carteira e recomendações de curto prazo.", marginX, (y += 4));
  y += 22;

  // KPI cards
  const cardH = 78;
  const gap = 12;
  const cardW = (contentW - gap * 2) / 3;
  const kpis: { label: string; value: string; sub?: string; color?: [number, number, number] }[] = [
    {
      label: "Patrimônio Atual",
      value: fmtBRL(metrics.totalCurrent),
      sub: `${metrics.assetsCount} ativos`,
    },
    {
      label: "Resultado",
      value: `${metrics.diff >= 0 ? "+" : ""}${fmtBRL(metrics.diff)}`,
      sub: `${metrics.rentPct >= 0 ? "+" : ""}${metrics.rentPct.toFixed(2)}% acumulado`,
      color: metrics.diff >= 0 ? positive : negative,
    },
    {
      label: "Dividendos (7d)",
      value: fmtBRL(metrics.dividendsWeek),
      sub: `${metrics.dividendsCount} pagamento(s)`,
    },
  ];
  kpis.forEach((k, i) => {
    const x = marginX + i * (cardW + gap);
    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(225, 230, 238);
    doc.roundedRect(x, y, cardW, cardH, 6, 6, "FD");
    doc.setFillColor(...(k.color ?? accent));
    doc.rect(x, y, 3, cardH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(k.label.toUpperCase(), x + 12, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...(k.color ?? dark));
    doc.text(k.value, x + 12, y + 42);
    if (k.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(k.sub, x + 12, y + 60);
    }
  });
  y += cardH + 24;

  // ===== Markdown body =====
  const stripBold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`([^`]+)`/g, "$1");

  const writeWrapped = (text: string, opts: { size: number; bold?: boolean; color?: [number, number, number]; lh?: number; indent?: number }) => {
    const size = opts.size;
    const lh = opts.lh ?? size * 1.35;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? dark));
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(text, contentW - indent);
    for (const line of lines) {
      ensureSpace(lh);
      doc.text(line, marginX + indent, y);
      y += lh;
    }
  };

  const drawSectionTitle = (text: string, level: number) => {
    y += level === 1 ? 14 : 8;
    ensureSpace(level === 1 ? 36 : 26);
    if (level === 1) {
      doc.setFillColor(...accent);
      doc.rect(marginX, y - 12, 3, 18, "F");
      writeWrapped(text, { size: 14, bold: true, indent: 10 });
    } else {
      writeWrapped(text, { size: 11.5, bold: true, color: accent });
    }
    y += 4;
  };

  const drawTable = (headers: string[], rows: string[][]) => {
    const colW = contentW / headers.length;
    const rowH = 22;
    ensureSpace(rowH * (rows.length + 1) + 8);
    // header
    doc.setFillColor(...accent);
    doc.rect(marginX, y, contentW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => doc.text(stripBold(h), marginX + i * colW + 8, y + 15));
    y += rowH;
    // rows
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    rows.forEach((r, ri) => {
      ensureSpace(rowH);
      if (ri % 2 === 0) {
        doc.setFillColor(247, 249, 252);
        doc.rect(marginX, y, contentW, rowH, "F");
      }
      r.forEach((c, i) => {
        const txt = doc.splitTextToSize(stripBold(c), colW - 16)[0] ?? "";
        doc.text(String(txt), marginX + i * colW + 8, y + 15);
      });
      y += rowH;
    });
    y += 6;
  };

  // Parse markdown line by line.
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = stripEmoji(raw).trimEnd();
    if (!line.trim()) { y += 4; i++; continue; }

    if (line.startsWith("## ")) {
      drawSectionTitle(line.replace(/^##\s+/, "").trim(), 1); i++; continue;
    }
    if (line.startsWith("### ")) {
      drawSectionTitle(line.replace(/^###\s+/, "").trim(), 2); i++; continue;
    }
    if (line.startsWith("# ")) {
      drawSectionTitle(line.replace(/^#\s+/, "").trim(), 1); i++; continue;
    }

    // Table block
    if (line.trim().startsWith("|") && (lines[i + 1] ?? "").includes("---")) {
      const headerCells = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].split("|").map((c) => stripEmoji(c).trim()).filter((_, idx, arr) => idx > 0 || arr[0] !== "");
        // re-split clean
        const clean = lines[i].split("|").slice(1, -1).map((c) => stripEmoji(c).trim());
        rows.push(clean.length ? clean : cells);
        i++;
      }
      drawTable(headerCells, rows);
      continue;
    }

    // Bullets
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    if (bullet) {
      ensureSpace(16);
      doc.setFillColor(...accent);
      doc.circle(marginX + 6, y - 3, 1.8, "F");
      writeWrapped(stripBold(bullet[1]), { size: 10.5, indent: 16 });
      i++; continue;
    }
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (numbered) {
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...accent);
      doc.text(`${numbered[1]}.`, marginX, y);
      writeWrapped(stripBold(numbered[2]), { size: 10.5, indent: 22 });
      i++; continue;
    }

    // Paragraph
    writeWrapped(stripBold(line), { size: 10.5 });
    i++;
  }

  drawFooter(pageNum);
  // Add total page count
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 135);
    doc.text(`Página ${p} de ${total}`, pageW - marginX, pageH - 18, { align: "right" });
  }

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(ab);
}

async function sendTelegramPdf(chatId: number, pdf: Uint8Array, filename: string, caption: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([pdf], { type: "application/pdf" }), filename);
  const r = await fetch(`${GATEWAY_URL}/sendDocument`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
    },
    body: form,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`sendDocument ${r.status}: ${t.slice(0, 300)}`);
  }
}

// ===== Vacancy scraping (Funds Explorer) =====
const VACANCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h cache

interface VacancyData {
  ticker: string;
  fisica: number | null;
  financeira: number | null;
  periodo: number | null;
}

async function scrapeVacancyFromFundsExplorer(ticker: string): Promise<VacancyData | null> {
  try {
    const url = `https://www.fundsexplorer.com.br/funds/${ticker.toLowerCase()}`;
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    if (!r.ok) return null;
    const html = await r.text();
    // Indices vacancia_{N}_vacancia_fisica / financeira / periodo. Pegamos o maior N.
    const re = /vacancia_(\d+)_vacancia_fisica"\s*:\s*([-\d.]+)/g;
    let bestN = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const n = Number(m[1]);
      if (n > bestN) bestN = n;
    }
    if (bestN < 0) return { ticker, fisica: null, financeira: null, periodo: null };
    const pickNum = (field: string): number | null => {
      const rx = new RegExp(`vacancia_${bestN}_${field}"\\s*:\\s*([-\\d.]+)`);
      const mm = rx.exec(html);
      return mm ? Number(mm[1]) : null;
    };
    return {
      ticker,
      fisica: pickNum("vacancia_fisica"),
      financeira: pickNum("vacancia_financeira"),
      periodo: pickNum("periodo") as number | null,
    };
  } catch (e) {
    console.error("vacancy scrape error", ticker, e);
    return null;
  }
}

async function getVacancyForTickers(admin: any, tickers: string[]): Promise<Record<string, VacancyData>> {
  const out: Record<string, VacancyData> = {};
  if (!tickers.length) return out;
  const upper = tickers.map((t) => t.toUpperCase());
  const { data: cached } = await admin
    .from("fii_vacancy_cache")
    .select("ticker, vacancia_fisica, vacancia_financeira, periodo, fetched_at")
    .in("ticker", upper);
  const cacheMap = new Map<string, any>((cached ?? []).map((r: any) => [r.ticker, r]));
  const now = Date.now();
  const toFetch: string[] = [];
  for (const t of upper) {
    const c = cacheMap.get(t);
    if (c && now - new Date(c.fetched_at).getTime() < VACANCY_TTL_MS) {
      out[t] = {
        ticker: t,
        fisica: c.vacancia_fisica !== null ? Number(c.vacancia_fisica) : null,
        financeira: c.vacancia_financeira !== null ? Number(c.vacancia_financeira) : null,
        periodo: c.periodo ?? null,
      };
    } else {
      toFetch.push(t);
    }
  }
  // Limit concurrency to avoid hammering Funds Explorer.
  const CONCURRENCY = 3;
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((t) => scrapeVacancyFromFundsExplorer(t)));
    for (let j = 0; j < batch.length; j++) {
      const t = batch[j];
      const r = results[j];
      if (r) {
        out[t] = r;
        await admin.from("fii_vacancy_cache").upsert({
          ticker: t,
          vacancia_fisica: r.fisica,
          vacancia_financeira: r.financeira,
          periodo: r.periodo,
          fetched_at: new Date().toISOString(),
        });
      } else {
        // Keep stale cache if it exists, otherwise mark unknown
        const stale = cacheMap.get(t);
        if (stale) {
          out[t] = {
            ticker: t,
            fisica: stale.vacancia_fisica !== null ? Number(stale.vacancia_fisica) : null,
            financeira: stale.vacancia_financeira !== null ? Number(stale.vacancia_financeira) : null,
            periodo: stale.periodo ?? null,
          };
        }
      }
    }
  }
  return out;
}

function formatPeriodo(p: number | null | undefined): string {
  if (!p) return "—";
  const s = String(p);
  if (s.length === 8) return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  if (s.length === 6) return `${s.slice(4, 6)}/${s.slice(0, 4)}`;
  return s;
}

// Paginated fetch to bypass PostgREST's default 1000-row cap.
const PAGE_SIZE = 1000;
async function fetchAllPaginated<T = any>(
  client: any,
  table: string,
  columns: string,
  apply?: (q: any) => any,
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Optional: { user_id, report_type } body for manual single-user run
    let body: { user_id?: string; report_type?: string } = {};
    try { body = await req.json(); } catch {}
    const reportType = body.report_type || "weekly";

    let users: { id: string }[] = [];
    if (body.user_id) {
      users = [{ id: body.user_id }];
    } else {
      // Paginate to ensure ALL users with assets are processed (not just first 1000 rows).
      const assetsRows = await fetchAllPaginated<{ user_id: string }>(admin, "assets", "user_id");
      const ids = Array.from(new Set(assetsRows.map((r) => r.user_id)));
      users = ids.map((id) => ({ id }));
    }

    let processed = 0;
    const errors: string[] = [];

    for (const u of users) {
      try {
        const assets = await fetchAllPaginated<any>(
          admin, "assets", "*", (q) => q.eq("user_id", u.id),
        );
        if (assets.length === 0) continue;

        // Apply transactions on top of asset rows so quantity/cost match the
        // dashboard (mirrors src/hooks/usePortfolio.ts `applyTransactions`).
        const txs = await fetchAllPaginated<any>(
          admin, "transactions",
          "ticker, type, quantity, price, other_costs, date",
          (q) => q.eq("user_id", u.id),
        );
        const txByTicker = new Map<string, any[]>();
        for (const t of txs ?? []) {
          if (!txByTicker.has(t.ticker)) txByTicker.set(t.ticker, []);
          txByTicker.get(t.ticker)!.push(t);
        }
        for (const a of assets) {
          const list = txByTicker.get(a.ticker);
          if (!list || list.length === 0) continue;
          let qty = Number(a.quantity || 0);
          let cost = Number(a.total_invested || 0);
          const sorted = [...list].sort((x, y) => String(x.date ?? "").localeCompare(String(y.date ?? "")));
          for (const tx of sorted) {
            const q = Number(tx.quantity), p = Number(tx.price), o = Number(tx.other_costs ?? 0);
            if (tx.type === "buy") { cost += q * p + o; qty += q; }
            else if (qty > 0) {
              const avg = cost / qty;
              qty = Math.max(0, qty - q);
              cost = qty * avg;
            }
          }
          a.quantity = qty;
          a.total_invested = cost;
          a.average_price = qty > 0 ? cost / qty : 0;
        }

        // Last week dividends
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const divs = await fetchAllPaginated<{ ticker: string; amount: number; payment_date: string }>(
          admin, "dividends", "ticker, amount, payment_date",
          (q) => q.eq("user_id", u.id).gte("payment_date", since.toISOString().slice(0, 10)),
        );

        // Snapshots last 30d for trend
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const snaps = await fetchAllPaginated<any>(
          admin, "portfolio_snapshots",
          "snapshot_date, total_current, total_invested, total_difference",
          (q) => q.eq("user_id", u.id).gte("snapshot_date", since30.toISOString().slice(0, 10)),
        );

        const totalInvested = assets.reduce((s: number, a: any) => s + Number(a.total_invested || 0), 0);
        const totalCurrent = assets.reduce((s: number, a: any) => s + Number(a.quantity || 0) * Number(a.current_price || 0), 0);
        const dividendsWeek = (divs ?? []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0);

        // Compute per-asset performance to highlight top/bottom 3
        const perf = assets.map((a: any) => {
          const qty = Number(a.quantity || 0);
          const avg = Number(a.average_price || 0);
          const cur = Number(a.current_price || 0);
          const invested = qty * avg;
          const atual = qty * cur;
          const diff = atual - invested;
          const pct = invested > 0 ? (diff / invested) * 100 : 0;
          return {
            ticker: a.ticker,
            cotas: qty,
            precoMedio: avg,
            precoAtual: cur,
            investido: invested,
            atual,
            diferenca: diff,
            variacaoPct: pct,
            dy: Number(a.dividend_yield || 0),
            pvp: Number(a.pvp || 0),
          };
        });
        const sortedByPct = [...perf].sort((a, b) => b.variacaoPct - a.variacaoPct);
        const top3 = sortedByPct.slice(0, 3);
        const bottom3 = sortedByPct.slice(-3).reverse();

        // Vacância dos FIIs de tijolo
        const tijolos = assets.filter((a: any) => String(a.fii_type ?? "").toLowerCase() === "tijolo");
        const vacancyMap = await getVacancyForTickers(admin, tijolos.map((a: any) => a.ticker));
        const vacanciaTijolos = tijolos
          .map((a: any) => {
            const v = vacancyMap[a.ticker.toUpperCase()];
            return {
              ticker: a.ticker,
              segmento: a.fii_segment ?? null,
              vacanciaFisicaPct: v?.fisica ?? null,
              vacanciaFinanceiraPct: v?.financeira ?? null,
              referencia: formatPeriodo(v?.periodo ?? null),
            };
          })
          .sort((a, b) => (b.vacanciaFisicaPct ?? -1) - (a.vacanciaFisicaPct ?? -1));

        const portfolioSummary = {
          totalInvested,
          totalCurrent,
          difference: totalCurrent - totalInvested,
          rentabilidadePct: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
          ativos: perf,
          top3Melhores: top3,
          top3Piores: bottom3,
          dividendosUltimaSemana: {
            total: dividendsWeek,
            quantidade: divs?.length ?? 0,
            detalhes: divs ?? [],
          },
          tendencia30d: snaps ?? [],
          vacanciaTijolos,
        };

        const systemPrompt = `Você é um analista financeiro especialista em FIIs e ações brasileiras.
Gere um RELATÓRIO SEMANAL profissional, bem formatado e fácil de ler em português brasileiro (máximo 800 palavras).

Estrutura OBRIGATÓRIA usando markdown rico (títulos, listas, negrito, tabelas e emojis sutis para hierarquia visual):

## 📊 Resumo Executivo
**SEMPRE a primeira seção do relatório.** Escreva exatamente 2 a 3 linhas curtas e diretas, em formato de parágrafo único, destacando obrigatoriamente em **negrito**:
- **Patrimônio atual** (valor de \`totalCurrent\` formatado como R$ com separador de milhar e 2 casas decimais).
- **Rentabilidade acumulada %** (valor de \`rentabilidadePct\` com 2 casas decimais e sinal + ou −).
- **Dividendos da semana** (valor de \`dividendosUltimaSemana.total\` em R$ e quantidade de pagamentos entre parênteses).
Não use listas nem subtítulos aqui — apenas um parágrafo enxuto e impactante que sirva como TL;DR da carteira.

## 📈 Performance da Semana
- Variação patrimonial absoluta e percentual
- Total de dividendos recebidos e quantidade de pagamentos
- Comparação com a tendência dos últimos 30 dias (use os snapshots)

## 🏆 Destaques da Carteira

### ✅ Top 3 Melhores
Apresente em **tabela markdown** com colunas: Ticker | Variação % | Comentário curto. Use exatamente os ativos de \`top3Melhores\`.

### ⚠️ Top 3 Piores
Apresente em **tabela markdown** com colunas: Ticker | Variação % | Comentário curto. Use exatamente os ativos de \`top3Piores\`.

## 🎯 Sugestões de Ação para a Próxima Semana
Liste de 3 a 5 ações **objetivas, numeradas e acionáveis** (ex: "Avaliar reforço em XPTO11 — DY de X% e P/VP abaixo de 1", "Reavaliar tese de YYYY3 após queda de Z%"). Cada item deve citar o ticker quando aplicável e o motivo em uma frase.

## 🏢 Vacância dos Tijolos
Se \`vacanciaTijolos\` estiver vazio, escreva apenas "Sem FIIs de tijolo classificados na carteira." Caso contrário, monte uma **tabela markdown** com colunas: Ticker | Segmento | Vacância Física | Vacância Financeira | Referência. Use exatamente os valores de \`vacanciaTijolos\` (formate números com 1 casa decimal e símbolo %; quando o valor for null, escreva "n/d"). Logo após a tabela, escreva 1 frase comentando a vacância média física ponderada e destacando o ticker com maior vacância (risco) e o de menor vacância (destaque positivo).

## 🔮 Visão para os Próximos Dias
1-2 frases de fechamento com perspectiva prática.

Regras de formatação:
- Use **negrito** para números e tickers importantes.
- Use tabelas markdown reais (com \`|\` e \`---\`) para os destaques.
- Não invente dados — use somente o que foi fornecido.
- Evite jargão excessivo; seja direto e prático.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Dados da carteira:\n\n${JSON.stringify(portfolioSummary, null, 2)}` },
            ],
          }),
        });

        if (!aiResp.ok) {
          const t = await aiResp.text();
          errors.push(`user ${u.id}: AI ${aiResp.status} ${t.slice(0, 200)}`);
          continue;
        }

        const aiJson = await aiResp.json();
        const content = aiJson.choices?.[0]?.message?.content as string | undefined;
        if (!content) { errors.push(`user ${u.id}: empty AI content`); continue; }

        const now = new Date();
        const BRT = "America/Sao_Paulo";
        const dateBR = now.toLocaleDateString("pt-BR", { timeZone: BRT });
        const timeBR = now.toLocaleTimeString("pt-BR", { timeZone: BRT });
        const title = reportType === "weekly"
          ? `Relatório Semanal — ${dateBR}`
          : `Relatório Manual — ${dateBR} ${timeBR}`;

        const { error: insErr } = await admin.from("ai_reports").insert({
          user_id: u.id,
          title,
          content,
          report_type: reportType,
          portfolio_snapshot: {
            totalInvested,
            totalCurrent,
            difference: totalCurrent - totalInvested,
            assetsCount: assets.length,
            dividendsWeek,
          },
        }).select("id").single();
        if (insErr) {
          errors.push(`user ${u.id}: insert ${insErr.message}`);
        } else {
          // Save executive snapshot for cross-report tracking
          const rentabilidadePct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
          const { data: prev } = await admin
            .from("report_snapshots")
            .select("id, total_current, rentabilidade_pct, dividends_week_total")
            .eq("user_id", u.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const reportRow = (insErr ? null : (await admin.from("ai_reports").select("id").eq("user_id", u.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data) as any;

          const { error: snapErr } = await admin.from("report_snapshots").insert({
            user_id: u.id,
            report_id: reportRow?.id ?? null,
            report_type: reportType,
            total_current: totalCurrent,
            total_invested: totalInvested,
            rentabilidade_pct: rentabilidadePct,
            dividends_week_total: dividendsWeek,
            dividends_week_count: divs?.length ?? 0,
            previous_snapshot_id: prev?.id ?? null,
            delta_current: prev ? totalCurrent - Number(prev.total_current) : null,
            delta_rentabilidade_pct: prev ? rentabilidadePct - Number(prev.rentabilidade_pct) : null,
            delta_dividends_week: prev ? dividendsWeek - Number(prev.dividends_week_total) : null,
          });
          if (snapErr) errors.push(`user ${u.id}: snapshot ${snapErr.message}`);
          processed++;
        }

        // Enqueue Telegram notification if user is linked + reports_enabled
        try {
          const { data: link } = await admin
            .from("telegram_links")
            .select("chat_id, reports_enabled")
            .eq("user_id", u.id)
            .maybeSingle();
          if (link && link.reports_enabled) {
            const diff = totalCurrent - totalInvested;
            const pct = totalInvested > 0 ? ((diff / totalInvested) * 100).toFixed(2) : "0.00";
            const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const caption =
              `<b>📊 ${escape(title)}</b>\n` +
              `Patrimônio: <b>${fmt(totalCurrent)}</b>\n` +
              `Resultado: ${fmt(diff)} (${pct}%)\n` +
              `Dividendos (7d): ${fmt(dividendsWeek)}\n\n` +
              `📎 Relatório executivo em PDF anexo.`;

            try {
              const pdfBytes = buildExecutivePdf({
                title,
                dateLabel: `${dateBR} ${timeBR}`,
                totalCurrent,
                totalInvested,
                diff,
                rentPct: totalInvested > 0 ? (diff / totalInvested) * 100 : 0,
                dividendsWeek,
                dividendsCount: divs?.length ?? 0,
                assetsCount: assets.length,
              }, content);
              const safeDate = dateBR.replace(/\//g, "-");
              const filename = `relatorio-${reportType}-${safeDate}.pdf`;
              await sendTelegramPdf(Number(link.chat_id), pdfBytes, filename, caption);
            } catch (pdfErr) {
              console.error("telegram pdf send error", pdfErr);
              // Fallback to text via outbox if PDF send fails
              await admin.from("telegram_outbox").insert({
                user_id: u.id,
                chat_id: link.chat_id,
                text: caption + `\n\n<i>(Falha ao gerar PDF, enviando resumo)</i>`,
                parse_mode: "HTML",
              });
            }
          }
        } catch (e) {
          console.error("telegram enqueue error", e);
        }
      } catch (e) {
        errors.push(`user ${u.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-ai-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
