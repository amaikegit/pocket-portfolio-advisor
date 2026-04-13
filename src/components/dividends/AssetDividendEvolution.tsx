import { useState } from "react";
import { Dividend } from "@/hooks/useDividends";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Search } from "lucide-react";

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  dividends: Dividend[];
}

export function AssetDividendEvolution({ dividends }: Props) {
  const tickers = [...new Set(dividends.map((d) => d.ticker))].sort();
  const [selectedTicker, setSelectedTicker] = useState<string>(tickers[0] || "");

  if (tickers.length === 0) return null;

  const filtered = dividends.filter((d) => d.ticker === selectedTicker);
  const monthTotals: Record<string, number> = {};
  filtered.forEach((d) => {
    const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
    monthTotals[key] = (monthTotals[key] || 0) + d.amount;
  });

  const sortedKeys = Object.keys(monthTotals).sort();
  const data = sortedKeys.map((key) => {
    const [y, m] = key.split("-");
    return {
      label: `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`,
      valor: monthTotals[key],
    };
  });

  const totalTicker = filtered.reduce((s, d) => s + d.amount, 0);
  const avgTicker = data.length > 0 ? totalTicker / data.length : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Search className="h-4 w-4" />
            Evolução por Ativo
          </CardTitle>
          <Select value={selectedTicker} onValueChange={setSelectedTicker}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tickers.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span>Total: <span className="text-primary font-medium">{formatBRL(totalTicker)}</span></span>
          <span>Média/mês: <span className="font-medium">{formatBRL(avgTicker)}</span></span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ valor: { label: selectedTicker, color: "hsl(38, 90%, 55%)" } }}
          className="h-[280px] w-full"
        >
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" className="text-xs" angle={-45} textAnchor="end" height={50} />
            <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} />} />
            <Bar dataKey="valor" name={selectedTicker} fill="hsl(38, 90%, 55%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
