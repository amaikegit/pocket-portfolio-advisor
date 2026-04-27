import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, LineChart as LineChartIcon } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Transaction } from "@/types/portfolio";
import { fetchAllPaginated } from "@/lib/supabasePagination";

type IndexId = "cdi" | "ipca" | "ifix" | "ibov";
type Mode = "base100" | "pct" | "abs";

const INDICES: { id: IndexId; label: string; color: string }[] = [
  { id: "cdi", label: "CDI", color: "hsl(38, 90%, 55%)" },
  { id: "ipca", label: "IPCA", color: "hsl(280, 60%, 55%)" },
  { id: "ifix", label: "IFIX", color: "hsl(200, 70%, 50%)" },
  { id: "ibov", label: "IBOV", color: "hsl(0, 70%, 50%)" },
];

const PORTFOLIO_COLOR = "hsl(var(--primary))";

const PERIODS: { label: string; value: string }[] = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1A", value: "1y" },
  { label: "YTD", value: "ytd" },
  { label: "Tudo", value: "max" },
];

interface Point { date: string; value: number }
interface SnapshotRow { snapshot_date: string; total_current: number }

function rangeStart(range: string): Date {
  const d = new Date();
  switch (range) {
    case "1mo": d.setMonth(d.getMonth() - 1); break;
    case "3mo": d.setMonth(d.getMonth() - 3); break;
    case "6mo": d.setMonth(d.getMonth() - 6); break;
    case "1y": d.setFullYear(d.getFullYear() - 1); break;
    case "ytd": d.setMonth(0); d.setDate(1); break;
    case "max": d.setFullYear(d.getFullYear() - 10); break;
    default: d.setMonth(d.getMonth() - 6);
  }
  return d;
}

function fmtDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/**
 * Build the user's portfolio value time series:
 * 1. Use portfolio_snapshots when available (forward-filled).
 * 2. Before the first snapshot, fall back to the cumulative invested cost from transactions.
 */
function buildPortfolioSeries(
  snapshots: SnapshotRow[],
  transactions: Transaction[],
  dates: string[],
): Point[] {
  if (dates.length === 0) return [];

  // Cumulative invested by date (proxy when no snapshots exist yet)
  const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const txDates: { date: string; cumulative: number }[] = [];
  let cum = 0;
  for (const tx of sortedTx) {
    if (tx.type === "buy") cum += tx.quantity * tx.price + tx.otherCosts;
    else cum -= tx.quantity * tx.price - tx.otherCosts;
    if (cum < 0) cum = 0;
    txDates.push({ date: tx.date, cumulative: cum });
  }

  const sortedSnaps = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  function snapshotAt(date: string): number | null {
    let v: number | null = null;
    for (const s of sortedSnaps) {
      if (s.snapshot_date <= date) v = Number(s.total_current);
      else break;
    }
    return v;
  }
  function investedAt(date: string): number {
    let v = 0;
    for (const t of txDates) {
      if (t.date <= date) v = t.cumulative;
      else break;
    }
    return v;
  }

  const out: Point[] = [];
  for (const d of dates) {
    const snap = snapshotAt(d);
    const value = snap ?? investedAt(d);
    if (value > 0) out.push({ date: d, value });
  }
  return out;
}

function normalize(series: Point[], mode: Mode): Point[] {
  if (series.length === 0) return [];
  const base = series[0].value;
  if (!base) return [];
  return series.map((p) => ({
    date: p.date,
    value: mode === "base100"
      ? Math.round((p.value / base) * 100 * 100) / 100
      : Math.round(((p.value - base) / base) * 100 * 100) / 100,
  }));
}

const CustomTooltip = ({ active, payload, label, mode }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number"
            ? mode === "base100" ? p.value.toFixed(2) : `${p.value.toFixed(2)}%`
            : "—"}
        </p>
      ))}
    </div>
  );
};

export function PortfolioBenchmark() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("6mo");
  const [mode, setMode] = useState<Mode>("base100");
  const [selected, setSelected] = useState<Set<IndexId>>(new Set(["cdi", "ifix", "ibov"]));
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [indexData, setIndexData] = useState<Record<IndexId, Point[]>>({} as any);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const indices = Array.from(selected);
      const [{ data: benchData, error: benchErr }, snapsRes, txRes] = await Promise.all([
        supabase.functions.invoke("fetch-benchmarks", { body: { indices, range: period } }),
        user
          ? supabase
              .from("portfolio_snapshots")
              .select("snapshot_date,total_current")
              .eq("user_id", user.id)
              .order("snapshot_date", { ascending: true })
          : Promise.resolve({ data: [] as any, error: null }),
        user
          ? fetchAllPaginated<any>("transactions", "date,ticker,type,quantity,price,other_costs", (q) =>
              q.eq("user_id", user.id),
            )
          : Promise.resolve([]),
      ]);
      if (benchErr) throw benchErr;
      setIndexData(benchData?.results ?? {});
      setSnapshots(((snapsRes as any)?.data ?? []) as SnapshotRow[]);
      setTransactions(
        (txRes as any[]).map((r: any) => ({
          id: "",
          type: r.type,
          assetType: "acoes",
          ticker: r.ticker,
          date: r.date,
          quantity: Number(r.quantity),
          price: Number(r.price),
          otherCosts: Number(r.other_costs),
          total: 0,
        })),
      );
      setFetched(true);
    } catch (e) {
      console.error("Benchmark load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [period, selected, user]);

  // Refetch when period changes after first load
  useEffect(() => {
    if (fetched) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    for (const id of selected) {
      for (const p of indexData[id] ?? []) allDates.add(p.date);
    }
    if (showPortfolio) {
      // Use index dates as the master timeline; portfolio is sampled on those dates.
    }
    const sortedDates = Array.from(allDates).sort();

    // Normalize each index series
    const normalizedIdx: Record<string, Map<string, number>> = {};
    for (const id of selected) {
      const norm = normalize(indexData[id] ?? [], mode);
      const m = new Map<string, number>();
      for (const p of norm) m.set(p.date, p.value);
      normalizedIdx[id] = m;
    }

    // Portfolio series sampled on master timeline
    let portfolioMap = new Map<string, number>();
    if (showPortfolio && sortedDates.length > 0) {
      const portfolioRaw = buildPortfolioSeries(snapshots, transactions, sortedDates);
      const norm = normalize(portfolioRaw, mode);
      for (const p of norm) portfolioMap.set(p.date, p.value);
    }

    // Forward-fill across date timeline
    const lastIdx: Record<string, number | undefined> = {};
    let lastPort: number | undefined;

    return sortedDates.map((d) => {
      const row: Record<string, any> = { date: fmtDate(d) };
      for (const id of selected) {
        const v = normalizedIdx[id].get(d);
        if (v !== undefined) lastIdx[id] = v;
        if (lastIdx[id] !== undefined) row[id.toUpperCase()] = lastIdx[id];
      }
      if (showPortfolio) {
        const v = portfolioMap.get(d);
        if (v !== undefined) lastPort = v;
        if (lastPort !== undefined) row["Carteira"] = lastPort;
      }
      return row;
    });
  }, [indexData, selected, mode, showPortfolio, snapshots, transactions]);

  const toggleIndex = (id: IndexId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // When user toggles indices after first load, refetch (since some weren't fetched before)
  useEffect(() => {
    if (fetched) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const yFormatter = (v: number) => (mode === "base100" ? v.toFixed(0) : `${v.toFixed(0)}%`);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            Carteira vs Índices
          </CardTitle>
          {!fetched ? (
            <Button onClick={loadAll} disabled={loading} size="sm" className="gap-2">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LineChartIcon className="h-3.5 w-3.5" />}
              Carregar Comparação
            </Button>
          ) : (
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((p) => (
                <Button
                  key={p.value}
                  variant={period === p.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPeriod(p.value)}
                  disabled={loading}
                >
                  {p.label}
                </Button>
              ))}
              <div className="ml-2 flex gap-1">
                <Button
                  variant={mode === "base100" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMode("base100")}
                >
                  Base 100
                </Button>
                <Button
                  variant={mode === "pct" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMode("pct")}
                >
                  % acum.
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!fetched && !loading && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Clique em "Carregar Comparação" para ver sua carteira lado a lado com CDI, IPCA, IFIX e IBOV.
          </p>
        )}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Buscando índices e dados da carteira...</span>
          </div>
        )}
        {fetched && !loading && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="bench-portfolio"
                  checked={showPortfolio}
                  onCheckedChange={(v) => setShowPortfolio(!!v)}
                  className="h-3.5 w-3.5"
                />
                <label htmlFor="bench-portfolio" className="text-xs font-semibold cursor-pointer" style={{ color: PORTFOLIO_COLOR }}>
                  Carteira
                </label>
              </div>
              {INDICES.map((idx) => (
                <div key={idx.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`bench-${idx.id}`}
                    checked={selected.has(idx.id)}
                    onCheckedChange={() => toggleIndex(idx.id)}
                    className="h-3.5 w-3.5"
                  />
                  <label htmlFor={`bench-${idx.id}`} className="text-xs cursor-pointer" style={{ color: idx.color }}>
                    {idx.label}
                  </label>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  tickFormatter={yFormatter}
                />
                <Tooltip content={<CustomTooltip mode={mode} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {showPortfolio && (
                  <Line
                    type="monotone"
                    dataKey="Carteira"
                    stroke={PORTFOLIO_COLOR}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                )}
                {INDICES.filter((i) => selected.has(i.id)).map((i) => (
                  <Line
                    key={i.id}
                    type="monotone"
                    dataKey={i.label}
                    stroke={i.color}
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