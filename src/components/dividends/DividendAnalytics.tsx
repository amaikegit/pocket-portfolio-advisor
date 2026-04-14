import { useState } from "react";
import { Dividend } from "@/hooks/useDividends";
import { AssetCalculated } from "@/types/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Target, Trophy, Percent, ChevronDown, ChevronRight } from "lucide-react";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  dividends: Dividend[];
  assets: AssetCalculated[];
}

export function DividendAnalytics({ dividends, assets }: Props) {
  const [tableOpen, setTableOpen] = useState(false);

  if (dividends.length === 0 || assets.length === 0) return null;

  const dividendByTicker: Record<string, number> = {};
  dividends.forEach((d) => {
    dividendByTicker[d.ticker] = (dividendByTicker[d.ticker] || 0) + d.amount;
  });

  const currentYear = new Date().getFullYear();
  const divCurrentYear: Record<string, number> = {};
  dividends
    .filter((d) => d.year === currentYear)
    .forEach((d) => {
      divCurrentYear[d.ticker] = (divCurrentYear[d.ticker] || 0) + d.amount;
    });

  const analyticsData = assets
    .filter((a) => dividendByTicker[a.ticker])
    .map((a) => {
      const totalDiv = dividendByTicker[a.ticker] || 0;
      const divYear = divCurrentYear[a.ticker] || 0;
      const yieldOnCost = a.totalInvested > 0 ? (totalDiv / a.totalInvested) * 100 : 0;
      const yieldOnCostYear = a.totalInvested > 0 ? (divYear / a.totalInvested) * 100 : 0;
      const monthsReceived = new Set(
        dividends.filter((d) => d.ticker === a.ticker).map((d) => `${d.year}-${d.month}`)
      ).size;
      const avgMonthly = monthsReceived > 0 ? totalDiv / monthsReceived : 0;

      return {
        ticker: a.ticker,
        totalDiv,
        divYear,
        invested: a.totalInvested,
        currentValue: a.totalCurrent,
        yieldOnCost: parseFloat(yieldOnCost.toFixed(2)),
        yieldOnCostYear: parseFloat(yieldOnCostYear.toFixed(2)),
        avgMonthly: parseFloat(avgMonthly.toFixed(2)),
        monthsReceived,
      };
    })
    .sort((a, b) => b.yieldOnCost - a.yieldOnCost);

  const topPayer = analyticsData.length > 0 ? analyticsData.reduce((a, b) => (a.totalDiv > b.totalDiv ? a : b)) : null;
  const totalDivAll = Object.values(dividendByTicker).reduce((s, v) => s + v, 0);
  const totalInvestedAll = assets.reduce((s, a) => s + a.totalInvested, 0);
  const globalYOC = totalInvestedAll > 0 ? (totalDivAll / totalInvestedAll) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Percent className="h-3.5 w-3.5" />
              Yield on Cost Global
            </div>
            <p className="text-lg font-mono font-bold text-primary">{globalYOC.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Trophy className="h-3.5 w-3.5" />
              Maior Pagador
            </div>
            <p className="text-lg font-mono font-bold">{topPayer?.ticker || "-"}</p>
            <p className="text-xs text-muted-foreground">{topPayer ? formatBRL(topPayer.totalDiv) : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3.5 w-3.5" />
              YoC Ano ({currentYear})
            </div>
            <p className="text-lg font-mono font-bold">
              {totalInvestedAll > 0 ? ((Object.values(divCurrentYear).reduce((s, v) => s + v, 0) / totalInvestedAll) * 100).toFixed(2) : "0.00"}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3.5 w-3.5" />
              Ativos Analisados
            </div>
            <p className="text-lg font-mono font-bold">{analyticsData.length}</p>
          </CardContent>
        </Card>
      </div>

      <Collapsible open={tableOpen} onOpenChange={setTableOpen}>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-mono uppercase hover:text-primary transition-colors">
                {tableOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Análise por Ativo (Dividendos × Carteira)
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">Ticker</TableHead>
                      <TableHead className="font-mono text-xs text-right">Investido</TableHead>
                      <TableHead className="font-mono text-xs text-right">Div. Total</TableHead>
                      <TableHead className="font-mono text-xs text-right">Div. {currentYear}</TableHead>
                      <TableHead className="font-mono text-xs text-right">YoC Total</TableHead>
                      <TableHead className="font-mono text-xs text-right">YoC {currentYear}</TableHead>
                      <TableHead className="font-mono text-xs text-right">Média/Mês</TableHead>
                      <TableHead className="font-mono text-xs text-center">Meses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.map((a) => (
                      <TableRow key={a.ticker}>
                        <TableCell className="font-mono text-xs font-medium">{a.ticker}</TableCell>
                        <TableCell className="font-mono text-xs text-right">{formatBRL(a.invested)}</TableCell>
                        <TableCell className="font-mono text-xs text-right text-primary">{formatBRL(a.totalDiv)}</TableCell>
                        <TableCell className="font-mono text-xs text-right">{formatBRL(a.divYear)}</TableCell>
                        <TableCell className="font-mono text-xs text-right font-medium">{a.yieldOnCost}%</TableCell>
                        <TableCell className="font-mono text-xs text-right">{a.yieldOnCostYear}%</TableCell>
                        <TableCell className="font-mono text-xs text-right">{formatBRL(a.avgMonthly)}</TableCell>
                        <TableCell className="font-mono text-xs text-center">{a.monthsReceived}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
