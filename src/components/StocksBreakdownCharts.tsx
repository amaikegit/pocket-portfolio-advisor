import { useMemo, useState } from "react";
import { AssetCalculated } from "@/types/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { resolveStockClassification } from "@/lib/stockClassification";
import { getAssetKind } from "@/lib/assetKind";

const COLORS = [
  "hsl(210, 70%, 55%)",
  "hsl(35, 85%, 55%)",
  "hsl(150, 55%, 45%)",
  "hsl(0, 65%, 55%)",
  "hsl(265, 60%, 60%)",
  "hsl(190, 65%, 50%)",
  "hsl(45, 80%, 55%)",
  "hsl(330, 60%, 55%)",
  "hsl(110, 50%, 45%)",
  "hsl(20, 75%, 55%)",
  "hsl(240, 55%, 60%)",
  "hsl(170, 55%, 45%)",
];

const fmtCur = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Metric = "value" | "count";
interface Slice { name: string; value: number; rawValue: number; count: number }

function buildSlices(
  assets: AssetCalculated[],
  pick: (a: AssetCalculated) => string | null,
  metric: Metric,
): Slice[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const a of assets) {
    const key = pick(a);
    if (!key) continue;
    const cur = map.get(key) ?? { value: 0, count: 0 };
    cur.value += a.totalCurrent;
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, rawValue: v.value, count: v.count, value: metric === "value" ? v.value : v.count }))
    .sort((a, b) => b.value - a.value);
}

const TooltipContent = ({ active, payload, total, metric }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Slice;
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">{pct}% do total</p>
      {metric === "value" ? (
        <>
          <p className="text-muted-foreground">{fmtCur(d.rawValue)}</p>
          <p className="text-muted-foreground">{d.count} ação(ões)</p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{d.count} ação(ões)</p>
          <p className="text-muted-foreground">{fmtCur(d.rawValue)}</p>
        </>
      )}
    </div>
  );
};

function Donut({ data, metric }: { data: Slice[]; metric: Metric }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0) {
    return <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">Nenhuma ação na carteira</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name"
          stroke="hsl(var(--background))" strokeWidth={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<TooltipContent total={total} metric={metric} />} />
        <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StocksBreakdownCharts({ assets }: { assets: AssetCalculated[] }) {
  const [metric, setMetric] = useState<Metric>("value");
  const stocks = useMemo(() => assets.filter((a) => getAssetKind(a.ticker) === "stock"), [assets]);

  const sectorData = useMemo(
    () => buildSlices(stocks, (a) => resolveStockClassification(a.ticker, a.fiiType, a.fiiSegment)?.sector ?? null, metric),
    [stocks, metric],
  );
  const industryData = useMemo(
    () => buildSlices(stocks, (a) => resolveStockClassification(a.ticker, a.fiiType, a.fiiSegment)?.industry ?? null, metric),
    [stocks, metric],
  );

  if (stocks.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-sm font-mono text-muted-foreground">Distribuição das Ações</CardTitle>
        <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as Metric)} size="sm">
          <ToggleGroupItem value="value" className="text-xs h-7 px-2">Valor (R$)</ToggleGroupItem>
          <ToggleGroupItem value="count" className="text-xs h-7 px-2">Quantidade</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-2 text-center">Por Setor</p>
            <Donut data={sectorData} metric={metric} />
          </div>
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-2 text-center">Por Subsetor / Indústria</p>
            <Donut data={industryData} metric={metric} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}