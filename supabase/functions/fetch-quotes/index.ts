import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteResult {
  price: number | null;
  forwardDividendYield: number | null; // annual forward dividend yield (absolute R$)
}

async function fetchFromBrapi(ticker: string): Promise<QuoteResult> {
  try {
    const res = await fetch(
      `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=1d&interval=1d`
    );
    const data = await res.json();
    const r = data?.results?.[0];
    const price = typeof r?.regularMarketPrice === "number" ? r.regularMarketPrice : null;
    // brapi doesn't reliably return forward dividend, so return null
    return { price, forwardDividendYield: null };
  } catch {
    return { price: null, forwardDividendYield: null };
  }
}

async function fetchFromYahooV6(ticker: string): Promise<QuoteResult> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(symbol)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const r = data?.quoteResponse?.result?.[0];
    const price = typeof r?.regularMarketPrice === "number" ? r.regularMarketPrice : null;
    const fdy = typeof r?.trailingAnnualDividendRate === "number" ? r.trailingAnnualDividendRate : null;
    return { price, forwardDividendYield: fdy };
  } catch {
    return { price: null, forwardDividendYield: null };
  }
}

async function fetchFromYahooChart(ticker: string): Promise<QuoteResult> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = typeof meta?.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
    return { price, forwardDividendYield: null };
  } catch {
    return { price: null, forwardDividendYield: null };
  }
}

async function fetchFromYahooScrape(ticker: string): Promise<QuoteResult> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
    );
    const html = await res.text();

    // Extract price
    let price: number | null = null;
    const priceMatch = html.match(/"regularMarketPrice":\{"raw":([\d.]+)/);
    if (priceMatch) price = parseFloat(priceMatch[1]);

    // Extract trailing annual dividend rate
    let fdy: number | null = null;
    const divMatch = html.match(/"trailingAnnualDividendRate":\{"raw":([\d.]+)/);
    if (divMatch) fdy = parseFloat(divMatch[1]);

    return { price, forwardDividendYield: fdy };
  } catch {
    return { price: null, forwardDividendYield: null };
  }
}

async function fetchQuote(ticker: string): Promise<QuoteResult> {
  // Try brapi first
  let result = await fetchFromBrapi(ticker);
  if (result.price !== null && result.forwardDividendYield !== null) return result;

  // Keep partial results
  let bestPrice = result.price;
  let bestDY = result.forwardDividendYield;

  // Yahoo v6
  result = await fetchFromYahooV6(ticker);
  if (result.price !== null) bestPrice = result.price;
  if (result.forwardDividendYield !== null) bestDY = result.forwardDividendYield;
  if (bestPrice !== null && bestDY !== null) return { price: bestPrice, forwardDividendYield: bestDY };

  // Yahoo chart (price only)
  result = await fetchFromYahooChart(ticker);
  if (result.price !== null) bestPrice = result.price;
  if (bestPrice !== null && bestDY !== null) return { price: bestPrice, forwardDividendYield: bestDY };

  // Yahoo scrape as last resort
  result = await fetchFromYahooScrape(ticker);
  if (result.price !== null) bestPrice = result.price;
  if (result.forwardDividendYield !== null) bestDY = result.forwardDividendYield;

  return { price: bestPrice, forwardDividendYield: bestDY };
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
