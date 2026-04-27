import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Point {
  date: string; // YYYY-MM-DD
  value: number; // index level (base = first point of the SERIES, not normalized here)
}

// SGS series codes (Banco Central do Brasil)
// 12  = CDI diária (% a.d.)
// 433 = IPCA mensal (% a.m.)
const SGS = {
  cdi: 12,
  ipca: 433,
} as const;

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function ddmmyyyy(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function parseBcbDate(s: string): string {
  // "31/12/2024" -> "2024-12-31"
  const [dd, mm, yyyy] = s.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchBcbSeries(code: number, start: Date, end: Date): Promise<{ date: string; pct: number }[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${ddmmyyyy(start)}&dataFinal=${ddmmyyyy(end)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr
      .map((r: any) => ({ date: parseBcbDate(r.data), pct: Number(String(r.valor).replace(",", ".")) }))
      .filter((r) => !Number.isNaN(r.pct));
  } catch (e) {
    console.log(`BCB error ${code}:`, (e as Error).message);
    return [];
  }
}

/** Compound a percent-per-period series into an index level (base 1 at first point). */
function compound(series: { date: string; pct: number }[]): Point[] {
  let level = 1;
  const out: Point[] = [];
  for (const r of series) {
    level = level * (1 + r.pct / 100);
    out.push({ date: r.date, value: Math.round(level * 1e6) / 1e6 });
  }
  return out;
}

async function fetchYahooHistory(symbol: string, range: string, interval: string): Promise<Point[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const ts: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const out: Point[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c == null) continue;
      out.push({ date: ymd(new Date(ts[i] * 1000)), value: Math.round(c * 100) / 100 });
    }
    return out;
  } catch (e) {
    console.log(`Yahoo error ${symbol}:`, (e as Error).message);
    return [];
  }
}

function rangeToDates(range: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case "1mo": start.setMonth(end.getMonth() - 1); break;
    case "3mo": start.setMonth(end.getMonth() - 3); break;
    case "6mo": start.setMonth(end.getMonth() - 6); break;
    case "1y": start.setFullYear(end.getFullYear() - 1); break;
    case "ytd": start.setMonth(0); start.setDate(1); break;
    case "max": start.setFullYear(end.getFullYear() - 10); break;
    default: start.setMonth(end.getMonth() - 6);
  }
  return { start, end };
}

const YAHOO_RANGE_MAP: Record<string, { range: string; interval: string }> = {
  "1mo": { range: "1mo", interval: "1d" },
  "3mo": { range: "3mo", interval: "1d" },
  "6mo": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "ytd": { range: "ytd", interval: "1d" },
  "max": { range: "10y", interval: "1wk" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { indices = ["cdi", "ipca", "ifix", "ibov"], range = "6mo" } = await req.json();
    const { start, end } = rangeToDates(range);
    const yahoo = YAHOO_RANGE_MAP[range] ?? YAHOO_RANGE_MAP["6mo"];

    const tasks = indices.map(async (id: string): Promise<[string, Point[]]> => {
      if (id === "cdi") {
        const raw = await fetchBcbSeries(SGS.cdi, start, end);
        return ["cdi", compound(raw)];
      }
      if (id === "ipca") {
        const raw = await fetchBcbSeries(SGS.ipca, start, end);
        return ["ipca", compound(raw)];
      }
      if (id === "ifix") return ["ifix", await fetchYahooHistory("^IFIX", yahoo.range, yahoo.interval)];
      if (id === "ibov") return ["ibov", await fetchYahooHistory("^BVSP", yahoo.range, yahoo.interval)];
      return [id, []];
    });

    const entries = await Promise.all(tasks);
    const results: Record<string, Point[]> = {};
    for (const [id, pts] of entries) results[id] = pts;

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});