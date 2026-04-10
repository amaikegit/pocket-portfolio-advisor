import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteResult {
  price: number | null;
  dividendYield: number | null;
  pvp: number | null;
}

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

async function fetchFromYahooChart(ticker: string): Promise<{ price: number | null; lastDividend: number | null }> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=1y&events=div`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    
    const divEvents = result?.events?.dividends;
    let lastDividend: number | null = null;
    
    if (divEvents && typeof divEvents === "object") {
      const dividends = Object.values(divEvents) as Array<{ amount: number; date: number }>;
      if (dividends.length > 0) {
        dividends.sort((a: any, b: any) => (b.date || 0) - (a.date || 0));
        const lastAmount = dividends[0]?.amount;
        if (typeof lastAmount === "number" && lastAmount > 0) {
          lastDividend = lastAmount;
        }
      }
    }

    return {
      price: typeof price === "number" ? price : null,
      lastDividend,
    };
  } catch (e) {
    console.log(`Yahoo chart error for ${ticker}: ${e.message}`);
    return { price: null, lastDividend: null };
  }
}

async function fetchPvpFromYahoo(ticker: string): Promise<number | null> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const stats = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
    const pbRatio = stats?.priceToBook?.raw;
    console.log(`Yahoo P/VP for ${symbol}: ${pbRatio}`);
    return typeof pbRatio === "number" ? Math.round(pbRatio * 100) / 100 : null;
  } catch (e) {
    console.log(`Yahoo P/VP error for ${ticker}: ${e.message}`);
    return null;
  }
}

async function fetchQuote(ticker: string): Promise<QuoteResult> {
  let price = await fetchFromBrapi(ticker);
  
  const [yahoo, pvp] = await Promise.all([
    fetchFromYahooChart(ticker),
    fetchPvpFromYahoo(ticker),
  ]);
  
  if (price === null) price = yahoo.price;

  const monthlyDY = yahoo.lastDividend !== null
    ? Math.round(yahoo.lastDividend * 100) / 100
    : null;

  return { price, dividendYield: monthlyDY, pvp };
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

    const entries = await Promise.all(
      tickers.map(async (ticker: string) => {
        const quote = await fetchQuote(ticker);
        return [ticker, quote] as const;
      })
    );

    const results: Record<string, QuoteResult> = {};
    for (const [ticker, quote] of entries) {
      results[ticker] = quote;
    }

    console.log("Results:", JSON.stringify(results));

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
