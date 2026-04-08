import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchFromBrapi(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=1d&interval=1d`
    );
    const data = await res.json();
    const price = data?.results?.[0]?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

async function fetchFromYahooV6(ticker: string): Promise<number | null> {
  try {
    // Try with .SA suffix for Brazilian stocks
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(symbol)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

async function fetchFromYahooChart(ticker: string): Promise<number | null> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

async function fetchPrice(ticker: string): Promise<number | null> {
  // Try brapi first (no token = free tier with rate limits)
  let price = await fetchFromBrapi(ticker);
  if (price !== null) return price;

  // Fallback: Yahoo v6
  price = await fetchFromYahooV6(ticker);
  if (price !== null) return price;

  // Fallback: Yahoo chart
  price = await fetchFromYahooChart(ticker);
  if (price !== null) return price;

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: "No tickers provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all tickers concurrently
    const entries = await Promise.all(
      tickers.map(async (ticker: string) => {
        const price = await fetchPrice(ticker);
        return [ticker, price] as const;
      })
    );

    const results: Record<string, number | null> = {};
    for (const [ticker, price] of entries) {
      results[ticker] = price;
    }

    console.log("Fetch results:", JSON.stringify(results));

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
