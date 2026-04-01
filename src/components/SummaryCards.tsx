import { TrendingUp, TrendingDown, Wallet, BarChart3 } from "lucide-react";

interface SummaryCardsProps {
  totals: {
    totalCurrent: number;
    totalInvested: number;
    totalDifference: number;
    totalVariation: number;
  };
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function SummaryCard({ label, value, icon: Icon, colored = false }: {
  label: string;
  value: number;
  icon: React.ElementType;
  colored?: boolean;
}) {
  const colorClass = colored
    ? value > 0
      ? "text-positive"
      : value < 0
      ? "text-negative"
      : "text-foreground"
    : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-mono-display text-xl font-bold ${colorClass}`}>{fmt(value)}</p>
    </div>
  );
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard label="Total Atual" value={totals.totalCurrent} icon={Wallet} />
      <SummaryCard label="Total Investido" value={totals.totalInvested} icon={BarChart3} />
      <SummaryCard label="Diferença" value={totals.totalDifference} icon={totals.totalDifference >= 0 ? TrendingUp : TrendingDown} colored />
      <SummaryCard label="Variação Total" value={totals.totalVariation} icon={totals.totalVariation >= 0 ? TrendingUp : TrendingDown} colored />
    </div>
  );
}
