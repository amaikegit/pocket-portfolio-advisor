import { useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { Asset, AssetCalculated } from "@/types/portfolio";
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
import { Input } from "@/components/ui/input";

interface PortfolioTableProps {
  assets: AssetCalculated[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Asset, "id">>) => void;
  
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

function EditableRow({
  asset,
  onSave,
  onCancel,
}: {
  asset: AssetCalculated;
  onSave: (updates: Partial<Omit<Asset, "id">>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ticker: asset.ticker,
    quantity: asset.quantity,
    currentPrice: asset.currentPrice,
    averagePrice: asset.averagePrice,
    totalInvested: asset.totalInvested,
    dividendYield: asset.dividendYield,
    pvp: asset.pvp,
  });

  const set = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    onSave({
      ticker: form.ticker.toUpperCase().trim(),
      quantity: form.quantity,
      currentPrice: form.currentPrice,
      averagePrice: form.averagePrice,
      totalInvested: form.totalInvested,
      dividendYield: form.dividendYield,
      pvp: form.pvp,
    });
  };

  return (
    <TableRow className="bg-muted/20">
      <TableCell>
        <Input className="h-7 w-20 text-xs font-semibold" value={form.ticker}
          onChange={(e) => set("ticker", e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className="h-7 w-16 text-xs text-right" type="number" min={0} value={form.quantity || ""}
          onChange={(e) => set("quantity", Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input className="h-7 w-20 text-xs text-right" type="number" step="0.01" value={form.currentPrice || ""}
          onChange={(e) => set("currentPrice", Number(e.target.value))} />
      </TableCell>
      <TableCell className="text-right">
        <span className="font-mono-display text-sm text-muted-foreground">{fmt(form.quantity * form.currentPrice)}</span>
      </TableCell>
      <TableCell>
        <Input className="h-7 w-20 text-xs text-right" type="number" step="0.01" value={form.averagePrice || ""}
          onChange={(e) => set("averagePrice", Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input className="h-7 w-24 text-xs text-right" type="number" step="0.01" value={form.totalInvested || ""}
          onChange={(e) => set("totalInvested", Number(e.target.value))} />
      </TableCell>
      <TableCell className="text-right">
        <span className="font-mono-display text-sm text-muted-foreground">—</span>
      </TableCell>
      <TableCell>
        <Input className="h-7 w-20 text-xs text-right" type="number" step="0.01" value={form.dividendYield || ""}
          onChange={(e) => set("dividendYield", Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input className="h-7 w-16 text-xs text-right" type="number" step="0.01" value={form.pvp || ""}
          onChange={(e) => set("pvp", Number(e.target.value))} />
      </TableCell>
      <TableCell colSpan={4} className="text-center text-muted-foreground text-xs">
        Campos calculados serão atualizados ao salvar
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-positive hover:text-positive"
            onClick={handleSave}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-negative"
            onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function PortfolioTable({ assets, onRemove, onUpdate }: PortfolioTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

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
            <TableHead className="font-mono-display text-xs w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((a) =>
            editingId === a.id ? (
              <EditableRow
                key={a.id}
                asset={a}
                onSave={(updates) => {
                  onUpdate(a.id, updates);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
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
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => setEditingId(a.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-negative"
                      onClick={() => onRemove(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
