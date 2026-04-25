import { useMemo, useState } from "react";
import { AssetCalculated } from "@/types/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { resolveClassification, isFiiTicker } from "@/lib/fiiClassification";

const COLORS = [
  "hsl(142, 60%, 45%)",
  "hsl(38, 90%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 50%)",
  "hsl(170, 60%, 45%)",
  "hsl(320, 60%, 50%)",
  "hsl(60, 70%, 50%)",
  "hsl(220, 60%, 55%)",
  "hsl(100, 50%, 45%)",
  "hsl(30, 80%, 50%)",
  "hsl(250, 50%, 55%)",
];

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Metric = "value" | "count";

interface Props {
  assets: AssetCalculated[];
}

interface Slice {
  name: string;
  value: number;
  rawValue: number;
  count: number;
}

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
    .map(([name, v]) => ({
      name,
      rawValue: v.value,
      count: v.count,
      value: metric === "value" ? v.value : v.count,
    }))
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
          <p className="text-muted-foreground">{formatCurrency(d.rawValue)}</p>
          <p className="text-muted-foreground">{d.count} ativo(s)</p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{d.count} ativo(s)</p>
          <p className="text-muted-foreground">{formatCurrency(d.rawValue)}</p>
        </>
      )}
    </div>
  );
};

function Donut({ data, metric }: { data: Slice[]; metric: Metric }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
        Nenhum FII na carteira
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          stroke="hsl(var(--background))"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<TooltipContent total={total} metric={metric} />} />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FIIBreakdownCharts({ assets }: Props) {
  const [metric, setMetric] = useState<Metric>("value");

  const fiis = useMemo(() => assets.filter((a) => isFiiTicker(a.ticker)), [assets]);

  const typeData = useMemo(
    () =>
      buildSlices(
        fiis,
        (a) => resolveClassification(a.ticker, a.fiiType, a.fiiSegment)?.type ?? null,
        metric,
      ),
    [fiis, metric],
  );
  const segmentData = useMemo(
    () =>
      buildSlices(
        fiis,
        (a) => resolveClassification(a.ticker, a.fiiType, a.fiiSegment)?.segment ?? null,
        metric,
      ),
    [fiis, metric],
  );

  if (fiis.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-sm font-mono text-muted-foreground">
          Distribuição dos FIIs
        </CardTitle>
        <ToggleGroup
          type="single"
          value={metric}
          onValueChange={(v) => v && setMetric(v as Metric)}
          size="sm"
        >
          <ToggleGroupItem value="value" className="text-xs h-7 px-2">
            Valor (R$)
          </ToggleGroupItem>
          <ToggleGroupItem value="count" className="text-xs h-7 px-2">
            Quantidade
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-2 text-center">
              Por Tipo
            </p>
            <Donut data={typeData} metric={metric} />
          </div>
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-2 text-center">
              Por Segmento
            </p>
            <Donut data={segmentData} metric={metric} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
