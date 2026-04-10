import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchFromBrapi(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=1d&interval=1d`);
    const data = await res.json();
    const price = data?.results?.[0]?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch { return null; }
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
        if (typeof lastAmount === "number" && lastAmount > 0) lastDividend = lastAmount;
      }
    }
    return { price: typeof price === "number" ? price : null, lastDividend };
  } catch { return { price: null, lastDividend: null }; }
}

async function fetchPvpFromYahoo(ticker: string): Promise<number | null> {
  try {
    const symbol = ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const pbRatio = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics?.priceToBook?.raw;
    return typeof pbRatio === "number" ? Math.round(pbRatio * 100) / 100 : null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all distinct tickers
    const { data: assets, error } = await supabase.from("assets").select("id, ticker");
    if (error) throw error;
    if (!assets || assets.length === 0) {
      return new Response(JSON.stringify({ message: "No assets to update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tickerMap: Record<string, string[]> = {};
    for (const a of assets) {
      if (!tickerMap[a.ticker]) tickerMap[a.ticker] = [];
      tickerMap[a.ticker].push(a.id);
    }

    const tickers = Object.keys(tickerMap);
    let updated = 0;

    await Promise.all(
      tickers.map(async (ticker) => {
        let price = await fetchFromBrapi(ticker);
        const [yahoo, pvp] = await Promise.all([
          fetchFromYahooChart(ticker),
          fetchPvpFromYahoo(ticker),
        ]);
        if (price === null) price = yahoo.price;

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (price !== null) { updates.current_price = price; updates.is_manual_price = false; }
        if (yahoo.lastDividend !== null) updates.dividend_yield = Math.round(yahoo.lastDividend * 100) / 100;
        if (pvp !== null) updates.pvp = pvp;

        if (Object.keys(updates).length > 1) {
          for (const id of tickerMap[ticker]) {
            await supabase.from("assets").update(updates).eq("id", id);
            updated++;
          }
        }
      })
    );

    console.log(`Auto-update: ${updated} assets updated for ${tickers.length} tickers`);

    return new Response(JSON.stringify({ updated, tickers: tickers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-update error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
