import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteResult {
  price: number | null;
  dividendYield: number | null; // monthly estimated DY in R$
}

async function fetchFromBrapi(ticker: string): Promise<{ price: number | null; annualDY: number | null; rawFields: Record<string, unknown> }> {
  try {
    const res = await fetch(
      `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=1d&interval=1d`
    );
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return { price: null, annualDY: null, rawFields: {} };

    const price = typeof r.regularMarketPrice === "number" ? r.regularMarketPrice : null;
    
    // brapi can return these fields:
    // dividendYield (percentage), trailingAnnualDividendRate (absolute R$), trailingAnnualDividendYield (percentage)
    let annualDY: number | null = null;
    
    if (typeof r.trailingAnnualDividendRate === "number" && r.trailingAnnualDividendRate > 0) {
      annualDY = r.trailingAnnualDividendRate;
    } else if (typeof r.dividendsData?.cashDividends?.[0]?.rate === "number") {
      // Use last dividend as monthly estimate
      annualDY = r.dividendsData.cashDividends[0].rate * 12;
    }

    // Log relevant fields for debugging
    const rawFields: Record<string, unknown> = {};
    for (const key of Object.keys(r)) {
      if (key.toLowerCase().includes("dividend") || key.toLowerCase().includes("yield")) {
        rawFields[key] = r[key];
      }
    }

    return { price, annualDY, rawFields };
  } catch {
    return { price: null, annualDY: null, rawFields: {} };
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

async function fetchQuote(ticker: string): Promise<QuoteResult & { debug: Record<string, unknown> }> {
  // Try brapi first (has both price and dividend data)
  const brapi = await fetchFromBrapi(ticker);
  
  let price = brapi.price;
  let annualDY = brapi.annualDY;

  // Fallback for price: Yahoo chart
  if (price === null) {
    price = await fetchFromYahooChart(ticker);
  }

  // Monthly DY = annual / 12
  const monthlyDY = annualDY !== null ? Math.round((annualDY / 12) * 100) / 100 : null;

  return {
    price,
    dividendYield: monthlyDY,
    debug: brapi.rawFields,
  };
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
    const debugInfo: Record<string, unknown> = {};
    for (const [ticker, quote] of entries) {
      results[ticker] = { price: quote.price, dividendYield: quote.dividendYield };
      if (Object.keys(quote.debug).length > 0) {
        debugInfo[ticker] = quote.debug;
      }
    }

    console.log("Results:", JSON.stringify(results));
    if (Object.keys(debugInfo).length > 0) {
      console.log("DY debug fields:", JSON.stringify(debugInfo));
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
