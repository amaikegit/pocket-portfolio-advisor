import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Transaction, TransactionType, AssetType } from "@/types/portfolio";

const assetTypes: { value: AssetType; label: string }[] = [
  { value: "acoes", label: "Ações" },
  { value: "fiis", label: "FIIs" },
  { value: "bdrs", label: "BDRs" },
  { value: "etfs", label: "ETFs" },
  { value: "cripto", label: "Cripto" },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  onAdd: (tx: Omit<Transaction, "id">) => void;
  existingTickers: string[];
  trigger?: React.ReactNode;
}

export function AddTransactionDialog({ onAdd, existingTickers, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("buy");
  const [assetType, setAssetType] = useState<AssetType>("acoes");
  const [ticker, setTicker] = useState("");
  const [customTicker, setCustomTicker] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);

  const total = useMemo(() => quantity * price + otherCosts, [quantity, price, otherCosts]);

  const effectiveTicker = ticker === "__new" ? customTicker.toUpperCase().trim() : ticker;

  const reset = () => {
    setType("buy");
    setAssetType("acoes");
    setTicker("");
    setCustomTicker("");
    setDate(new Date().toISOString().slice(0, 10));
    setQuantity(0);
    setPrice(0);
    setOtherCosts(0);
  };

  const handleSubmit = () => {
    if (!effectiveTicker) return;
    onAdd({
      type,
      assetType,
      ticker: effectiveTicker,
      date,
      quantity,
      price,
      otherCosts,
      total,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Lançamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono-display">Adicionar Lançamento</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-0 rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setType("buy")}
            className={`py-2.5 text-sm font-medium transition-colors ${
              type === "buy"
                ? "bg-primary/10 text-primary border-r border-border"
                : "bg-muted/30 text-muted-foreground border-r border-border hover:bg-muted/50"
            }`}
          >
            🛒 Compra
          </button>
          <button
            type="button"
            onClick={() => setType("sell")}
            className={`py-2.5 text-sm font-medium transition-colors ${
              type === "sell"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            💰 Venda
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Tipo de ativo</Label>
            <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {assetTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Ativo</Label>
            <Select value={ticker} onValueChange={setTicker}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {existingTickers.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="__new">+ Novo ativo</SelectItem>
              </SelectContent>
            </Select>
            {ticker === "__new" && (
              <Input
                placeholder="Ex: HGLG11"
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value)}
                className="mt-1.5"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Data da {type === "buy" ? "compra" : "venda"}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Quantidade</Label>
            <Input type="number" min={0} value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>

          <div className="space-y-1.5">
            <Label>Preço em R$</Label>
            <Input type="number" step="0.01" min={0} value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Outros custos <span className="text-xs">(Opcional)</span></Label>
            <Input type="number" step="0.01" min={0} value={otherCosts || ""} onChange={(e) => setOtherCosts(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 mt-2">
          <span className="font-medium text-sm">Valor total</span>
          <span className="font-mono-display font-bold text-base">R$ {fmt(total)}</span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!effectiveTicker || quantity <= 0} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Lançamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
