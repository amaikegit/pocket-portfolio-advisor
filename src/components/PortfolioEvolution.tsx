import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Asset } from "@/types/portfolio";

const COLORS = [
  "hsl(142, 60%, 45%)", "hsl(38, 90%, 55%)", "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)", "hsl(0, 70%, 50%)", "hsl(170, 60%, 45%)",
  "hsl(320, 60%, 50%)", "hsl(60, 70%, 50%)", "hsl(220, 60%, 55%)",
  "hsl(100, 50%, 45%)", "hsl(30, 80%, 50%)", "hsl(250, 50%, 55%)",
  "hsl(150, 50%, 40%)", "hsl(10, 70%, 55%)", "hsl(190, 60%, 45%)",
  "hsl(340, 55%, 50%)",
];

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1A", value: "1y" },
  { label: "2A", value: "2y" },
  { label: "5A", value: "5y" },
];

interface HistoricalPoint {
  date: string;
  close: number;
}

interface Props {
  assets: Asset[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md max-h-64 overflow-y-auto">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? `${p.value.toFixed(2)}%` : "—"}
        </p>
      ))}
    </div>
  );
};

export function PortfolioEvolution({ assets }: Props) {
  const [period, setPeriod] = useState("6mo");
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<Record<string, HistoricalPoint[]>>({});
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [showTotal, setShowTotal] = useState(true);
  const [fetched, setFetched] = useState(false);

  const tickers = useMemo(() => assets.map(a => a.ticker).sort(), [assets]);

  const fetchHistory = useCallback(async (range: string) => {
    if (tickers.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-historical-quotes", {
        body: { tickers, range },
      });
      if (error) throw error;
      setRawData(data.results || {});
      if (!fetched) {
        setSelectedTickers(new Set(tickers));
        setFetched(true);
      }
    } catch (e) {
      console.error("Failed to fetch historical data:", e);
    }
    setLoading(false);
  }, [tickers, fetched]);

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    fetchHistory(p);
  };

  const handleLoad = () => fetchHistory(period);

  const toggleTicker = (ticker: string) => {
    setSelectedTickers(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const selectAll = () => setSelectedTickers(new Set(tickers));
  const selectNone = () => setSelectedTickers(new Set());

  // Build chart data: normalize prices to % variation from first point
  const chartData = useMemo(() => {
    if (Object.keys(rawData).length === 0) return [];

    // Get all unique dates across all tickers
    const allDates = new Set<string>();
    for (const points of Object.values(rawData)) {
      for (const p of points) allDates.add(p.date);
    }
    const sortedDates = Array.from(allDates).sort();
    if (sortedDates.length === 0) return [];

    // Build base prices (first point for each ticker)
    const basePrices: Record<string, number> = {};
    for (const [ticker, points] of Object.entries(rawData)) {
      if (points.length > 0) basePrices[ticker] = points[0].close;
    }

    // Build per-date lookup
    const priceLookup: Record<string, Record<string, number>> = {};
    for (const [ticker, points] of Object.entries(rawData)) {
      for (const p of points) {
        if (!priceLookup[p.date]) priceLookup[p.date] = {};
        priceLookup[p.date][ticker] = p.close;
      }
    }

    // Build chart rows
    const activeTickers = tickers.filter(t => selectedTickers.has(t) && basePrices[t]);
    let lastKnown: Record<string, number> = {};

    return sortedDates.map(date => {
      const row: Record<string, any> = { date: formatDate(date) };
      const prices = priceLookup[date] || {};

      let totalCurrent = 0;
      let totalBase = 0;

      for (const ticker of activeTickers) {
        const current = prices[ticker] ?? lastKnown[ticker];
        if (current !== undefined) {
          lastKnown[ticker] = current;
          const base = basePrices[ticker];
          const variation = ((current - base) / base) * 100;
          row[ticker] = Math.round(variation * 100) / 100;

          const asset = assets.find(a => a.ticker === ticker);
          if (asset) {
            totalCurrent += current * asset.quantity;
            totalBase += base * asset.quantity;
          }
        }
      }

      if (showTotal && totalBase > 0) {
        row["Carteira Total"] = Math.round(((totalCurrent - totalBase) / totalBase) * 100 * 100) / 100;
      }

      return row;
    });
  }, [rawData, selectedTickers, showTotal, tickers, assets]);

  if (assets.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Evolução da Carteira (% Variação)
          </CardTitle>
          {!fetched ? (
            <Button onClick={handleLoad} disabled={loading} size="sm" className="gap-2">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Carregar Histórico
            </Button>
          ) : (
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <Button
                  key={p.value}
                  variant={period === p.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handlePeriodChange(p.value)}
                  disabled={loading}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!fetched && !loading && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Clique em "Carregar Histórico" para visualizar a evolução dos preços dos seus ativos.
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Buscando cotações históricas...</span>
          </div>
        )}

        {fetched && !loading && (
          <>
            {/* Ticker filter */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">Ativos:</span>
                <button onClick={selectAll} className="text-xs text-primary hover:underline">Todos</button>
                <button onClick={selectNone} className="text-xs text-primary hover:underline">Nenhum</button>
                <div className="flex items-center gap-1.5 ml-2">
                  <Checkbox
                    id="total"
                    checked={showTotal}
                    onCheckedChange={(v) => setShowTotal(!!v)}
                    className="h-3.5 w-3.5"
                  />
                  <label htmlFor="total" className="text-xs font-semibold text-foreground cursor-pointer">
                    Carteira Total
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {tickers.map((ticker, i) => (
                  <div key={ticker} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`evo-${ticker}`}
                      checked={selectedTickers.has(ticker)}
                      onCheckedChange={() => toggleTicker(ticker)}
                      className="h-3.5 w-3.5"
                    />
                    <label
                      htmlFor={`evo-${ticker}`}
                      className="text-xs cursor-pointer"
                      style={{ color: COLORS[i % COLORS.length] }}
                    >
                      {ticker}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                {showTotal && (
                  <Line
                    type="monotone"
                    dataKey="Carteira Total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                )}
                {tickers.filter(t => selectedTickers.has(t)).map((ticker, i) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
