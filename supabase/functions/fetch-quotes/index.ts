import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const results: Record<string, number | null> = {};

    // Fetch all tickers in one batch request
    const tickerList = tickers.join(",");
    try {
      const res = await fetch(
        `https://brapi.dev/api/quote/${encodeURIComponent(tickerList)}?token=demo`
      );
      const data = await res.json();
      
      if (data?.results && Array.isArray(data.results)) {
        for (const item of data.results) {
          if (item.symbol && typeof item.regularMarketPrice === "number") {
            results[item.symbol] = item.regularMarketPrice;
          }
        }
      }
    } catch (e) {
      console.error("Batch fetch failed, trying individual:", e);
    }

    // For any tickers not found in batch, try individually with alternative approach
    for (const ticker of tickers) {
      if (results[ticker] === undefined) {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?interval=1d&range=1d`
          );
          const data = await res.json();
          const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
          results[ticker] = typeof price === "number" ? price : null;
        } catch {
          results[ticker] = null;
        }
      }
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
