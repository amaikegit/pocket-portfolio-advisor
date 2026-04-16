import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HistoricalPoint {
  date: string;
  close: number;
}

async function fetchHistory(ticker: string, range: string, interval: string): Promise<HistoricalPoint[]> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

    const points: HistoricalPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close !== null && close !== undefined) {
        const d = new Date(timestamps[i] * 1000);
        points.push({
          date: d.toISOString().slice(0, 10),
          close: Math.round(close * 100) / 100,
        });
      }
    }
    return points;
  } catch (e) {
    console.log(`History error for ${ticker}: ${e.message}`);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers, range = "6mo" } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: "No tickers provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map range to appropriate interval
    const intervalMap: Record<string, string> = {
      "1mo": "1d",
      "3mo": "1d",
      "6mo": "1wk",
      "1y": "1wk",
      "2y": "1mo",
      "5y": "1mo",
    };
    const interval = intervalMap[range] || "1wk";

    const entries = await Promise.all(
      tickers.map(async (ticker: string) => {
        const history = await fetchHistory(ticker, range, interval);
        return [ticker, history] as const;
      })
    );

    const results: Record<string, HistoricalPoint[]> = {};
    for (const [ticker, history] of entries) {
      results[ticker] = history;
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
