import { TrendingUp, TrendingDown, Wallet, BarChart3, DollarSign, PieChart } from "lucide-react";

interface SummaryCardsProps {
  totals: {
    totalCurrent: number;
    totalInvested: number;
    totalDifference: number;
    totalVariation: number;
    totalMonthlyDY: number;
  };
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number) => `${v.toFixed(2)}%`;

export function SummaryCards({ totals }: SummaryCardsProps) {
  const variationPct = totals.totalInvested > 0
    ? ((totals.totalCurrent - totals.totalInvested) / totals.totalInvested) * 100
    : 0;

  const dyPct = totals.totalCurrent > 0
    ? (totals.totalMonthlyDY / totals.totalCurrent) * 100
    : 0;

  const profitColor = totals.totalDifference >= 0 ? "text-positive" : "text-negative";
  const variationColor = variationPct >= 0 ? "text-positive" : "text-negative";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Patrimônio Total */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Patrimônio total</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="font-mono-display text-xl font-bold">{fmt(totals.totalCurrent)}</p>
          <span className={`text-xs font-medium ${variationColor}`}>
            {variationPct >= 0 ? "▲" : "▼"} {pct(Math.abs(variationPct))}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span>Valor investido</span>
          <p className="font-medium text-foreground/80">{fmt(totals.totalInvested)}</p>
        </div>
      </div>

      {/* Lucro Total */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          {totals.totalDifference >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span className="text-xs font-medium uppercase tracking-wider">Lucro total</span>
        </div>
        <p className={`font-mono-display text-xl font-bold ${profitColor}`}>{fmt(totals.totalDifference)}</p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div>
            <span>Ganho de Capital</span>
            <p className={`font-medium ${profitColor}`}>{fmt(totals.totalVariation)}</p>
          </div>
        </div>
      </div>

      {/* Proventos Estimados (12M) */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Proventos Est. (12M)</span>
        </div>
        <p className="font-mono-display text-xl font-bold">{fmt(totals.totalMonthlyDY * 12)}</p>
        <div className="text-xs text-muted-foreground">
          <span>Total estimado anual</span>
          <p className="font-medium text-foreground/80">{fmt(totals.totalMonthlyDY * 12)}</p>
        </div>
      </div>

      {/* DY Mensal Estimado */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">DY Mensal Estimado</span>
        </div>
        <p className="font-mono-display text-xl font-bold text-positive">{fmt(totals.totalMonthlyDY)}</p>
        <div className="text-xs text-muted-foreground">
          <span>% sobre carteira</span>
          <p className="font-medium text-foreground/80">{pct(dyPct)}</p>
        </div>
      </div>

      {/* Variação / Rentabilidade */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <PieChart className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Variação</span>
        </div>
        <div className="flex items-baseline gap-3">
          <div>
            <span className={`font-mono-display text-xl font-bold ${variationColor}`}>
              {variationPct >= 0 ? "▲" : "▼"} {pct(Math.abs(variationPct))}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          <span>Variação total</span>
          <p className={`font-medium ${variationColor}`}>{fmt(totals.totalVariation)}</p>
        </div>
      </div>
    </div>
  );
}
