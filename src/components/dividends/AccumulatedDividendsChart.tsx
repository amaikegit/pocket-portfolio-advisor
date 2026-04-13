import { Dividend } from "@/hooks/useDividends";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  dividends: Dividend[];
}

export function AccumulatedDividendsChart({ dividends }: Props) {
  if (dividends.length === 0) return null;

  const monthTotals: Record<string, number> = {};
  dividends.forEach((d) => {
    const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
    monthTotals[key] = (monthTotals[key] || 0) + d.amount;
  });

  const sortedKeys = Object.keys(monthTotals).sort();
  let accumulated = 0;
  const data = sortedKeys.map((key) => {
    accumulated += monthTotals[key];
    const [y, m] = key.split("-");
    return {
      label: `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`,
      acumulado: parseFloat(accumulated.toFixed(2)),
      mensal: monthTotals[key],
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Evolução Acumulada de Dividendos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            acumulado: { label: "Acumulado", color: "hsl(142, 60%, 45%)" },
          }}
          className="h-[300px] w-full"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" className="text-xs" angle={-45} textAnchor="end" height={50} />
            <YAxis className="text-xs" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatBRL(Number(value))}
                  labelFormatter={(label, payload) => {
                    if (payload?.[0]?.payload) {
                      return `${label} — Mensal: ${formatBRL(payload[0].payload.mensal)}`;
                    }
                    return label;
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="acumulado"
              stroke="hsl(142, 60%, 45%)"
              strokeWidth={2}
              fill="url(#accGrad)"
              dot={{ r: 3 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
