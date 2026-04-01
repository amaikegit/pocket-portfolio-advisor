import { Trash2, Pencil } from "lucide-react";
import { AssetCalculated } from "@/types/portfolio";
import { StarRating } from "@/components/StarRating";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface PortfolioTableProps {
  assets: AssetCalculated[];
  onRemove: (id: string) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number) => `${v.toFixed(2)}%`;

function ValueCell({ value, colored = false }: { value: number; colored?: boolean }) {
  const cls = colored
    ? value > 0
      ? "text-positive"
      : value < 0
      ? "text-negative"
      : ""
    : "";
  return <span className={`font-mono-display text-sm ${cls}`}>{fmt(value)}</span>;
}

export function PortfolioTable({ assets, onRemove }: PortfolioTableProps) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="font-mono-display text-lg">Nenhum ativo na carteira</p>
        <p className="text-sm mt-1">Adicione ativos ou importe um CSV para começar</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-mono-display text-xs">Ticker</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Cotas</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Valor Atual</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Total Atual</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Preço Médio</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Total Investido</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Diferença</TableHead>
            <TableHead className="font-mono-display text-xs text-right">DY (R$)</TableHead>
            <TableHead className="font-mono-display text-xs text-right">P/VP</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Rent. Mensal</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Var. Cota</TableHead>
            <TableHead className="font-mono-display text-xs text-center">Rating</TableHead>
            <TableHead className="font-mono-display text-xs text-right">% Carteira</TableHead>
            <TableHead className="font-mono-display text-xs text-right">Var. Total</TableHead>
            <TableHead className="font-mono-display text-xs w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((a) => (
            <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-mono-display font-semibold text-primary">
                {a.ticker}
              </TableCell>
              <TableCell className="text-right font-mono-display text-sm">
                {a.quantity}
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.currentPrice} />
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.totalCurrent} />
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.averagePrice} />
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.totalInvested} />
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.difference} colored />
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.dividendYield} />
              </TableCell>
              <TableCell className="text-right font-mono-display text-sm">
                {a.pvp.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                <span className={`font-mono-display text-sm ${a.monthlyProfitability > 0.8 ? "text-positive" : "text-muted-foreground"}`}>
                  {pct(a.monthlyProfitability)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.priceVariation} colored />
              </TableCell>
              <TableCell className="text-center">
                <StarRating rating={a.rating} />
              </TableCell>
              <TableCell className="text-right font-mono-display text-sm">
                {pct(a.portfolioProportion)}
              </TableCell>
              <TableCell className="text-right">
                <ValueCell value={a.totalVariationPerShare} colored />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-negative"
                  onClick={() => onRemove(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
