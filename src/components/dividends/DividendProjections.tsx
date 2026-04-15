import { useMemo } from "react";
import { Dividend } from "@/hooks/useDividends";
import { AssetCalculated } from "@/types/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, Wallet, BarChart3 } from "lucide-react";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  dividends: Dividend[];
  assets: AssetCalculated[];
  rawAssets: { ticker: string; dividendYield: number; quantity: number }[];
}

export function DividendProjections({ dividends, assets, rawAssets }: Props) {
  const totalCurrent = assets.reduce((s, a) => s + a.totalCurrent, 0);
  const totalInvested = assets.reduce((s, a) => s + a.totalInvested, 0);
  const totalDividends = dividends.reduce((s, d) => s + d.amount, 0);

  // Projected monthly income based on current DY
  const monthlyDYIncome = useMemo(() => {
    return rawAssets.reduce((s, a) => {
      const asset = assets.find((ca) => ca.ticker === a.ticker);
      if (!asset) return s;
      return s + (a.dividendYield / 100 / 12) * asset.totalCurrent;
    }, 0);
  }, [rawAssets, assets]);

  // 12-month projection
  const projection12m = useMemo(() => {
    const now = new Date();
    const data = [];
    let accumulated = 0;
    for (let i = 1; i <= 12; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      accumulated += monthlyDYIncome;
      data.push({
        label: `${MONTH_NAMES[futureDate.getMonth()]}/${futureDate.getFullYear().toString().slice(2)}`,
        projetado: parseFloat(monthlyDYIncome.toFixed(2)),
        acumulado: parseFloat(accumulated.toFixed(2)),
      });
    }
    return data;
  }, [monthlyDYIncome]);

  // YoY growth
  const yoyData = useMemo(() => {
    const byYear: Record<number, number> = {};
    dividends.forEach((d) => {
      byYear[d.year] = (byYear[d.year] || 0) + d.amount;
    });
    const sortedYears = Object.keys(byYear).map(Number).sort();
    return sortedYears.map((y, i) => {
      const prev = i > 0 ? byYear[sortedYears[i - 1]] : 0;
      const growth = prev > 0 ? ((byYear[y] - prev) / prev) * 100 : 0;
      return {
        year: y.toString(),
        total: parseFloat(byYear[y].toFixed(2)),
        growth: parseFloat(growth.toFixed(1)),
      };
    });
  }, [dividends]);

  // Coverage / Payback
  const coveragePct = totalInvested > 0 ? (totalDividends / totalInvested) * 100 : 0;
  const monthsToPayback = monthlyDYIncome > 0
    ? Math.ceil((totalInvested - totalDividends) / monthlyDYIncome)
    : 0;

  // Average received
  const uniqueMonths = new Set(dividends.map((d) => `${d.year}-${d.month}`)).size;
  const avgReceived = uniqueMonths > 0 ? totalDividends / uniqueMonths : 0;

  if (assets.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Renda Projetada/Mês
            </div>
            <p className="text-lg font-mono font-bold text-primary">{formatBRL(monthlyDYIncome)}</p>
            <p className="text-xs text-muted-foreground">Baseado no DY atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="h-3.5 w-3.5" />
              Média Recebida/Mês
            </div>
            <p className="text-lg font-mono font-bold">{formatBRL(avgReceived)}</p>
            <p className="text-xs text-muted-foreground">{uniqueMonths} meses com recebimento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3.5 w-3.5" />
              Cobertura (Payback)
            </div>
            <p className="text-lg font-mono font-bold">{coveragePct.toFixed(1)}%</p>
            <Progress value={Math.min(coveragePct, 100)} className="h-2 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">
              {monthsToPayback > 0 && totalDividends < totalInvested
                ? `~${monthsToPayback} meses restantes`
                : coveragePct >= 100
                ? "Investimento recuperado!"
                : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Projeção 12 Meses
            </div>
            <p className="text-lg font-mono font-bold text-primary">
              {formatBRL(monthlyDYIncome * 12)}
            </p>
            <p className="text-xs text-muted-foreground">Total projetado próx. ano</p>
          </CardContent>
        </Card>
      </div>

      {/* 12-month projection chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono">Projeção de Dividendos — Próximos 12 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              projetado: { label: "Mensal", color: "hsl(142, 60%, 45%)" },
              acumulado: { label: "Acumulado", color: "hsl(200, 70%, 50%)" },
            }}
            className="h-[280px] w-full"
          >
            <LineChart data={projection12m}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis tickFormatter={(v) => `R$${v}`} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBRL(Number(v))} />} />
              <Line type="monotone" dataKey="projetado" stroke="hsl(142, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="acumulado" stroke="hsl(200, 70%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* YoY Growth */}
      {yoyData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono">Crescimento Anual (YoY)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ total: { label: "Total", color: "hsl(142, 60%, 45%)" } }}
              className="h-[280px] w-full"
            >
              <BarChart data={yoyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis tickFormatter={(v) => `R$${v}`} className="text-xs" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatBRL(Number(value))}
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload?.growth) {
                          const g = payload[0].payload.growth;
                          return `${label} (${g > 0 ? "+" : ""}${g}%)`;
                        }
                        return label;
                      }}
                    />
                  }
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {yoyData.map((entry, i) => (
                    <Cell key={i} fill={entry.growth >= 0 ? "hsl(142, 60%, 45%)" : "hsl(0, 70%, 50%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
