import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FII_TYPES, FII_SEGMENTS, isFiiTicker, suggestClassification } from "@/lib/fiiClassification";
import type { Asset } from "@/types/portfolio";

interface AddAssetDialogProps {
  onAdd: (asset: Omit<Asset, "id">) => void;
  trigger?: React.ReactNode;
}

const defaultAsset = {
  ticker: "",
  quantity: 0,
  currentPrice: 0,
  isManualPrice: true,
  averagePrice: 0,
  totalInvested: 0,
  dividendYield: 0,
  pvp: 0,
  fiiType: "" as string,
  fiiSegment: "" as string,
};

export function AddAssetDialog({ onAdd, trigger }: AddAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultAsset);

  const set = (key: string, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onTickerChange = (value: string) => {
    const upper = value.toUpperCase();
    setForm((f) => {
      const next = { ...f, ticker: value };
      if (isFiiTicker(upper) && !f.fiiType && !f.fiiSegment) {
        const sug = suggestClassification(upper);
        if (sug) {
          next.fiiType = sug.type;
          next.fiiSegment = sug.segment;
        }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker.trim()) return;
    onAdd({
      ...form,
      ticker: form.ticker.toUpperCase().trim(),
      fiiType: form.fiiType || null,
      fiiSegment: form.fiiSegment || null,
    });
    setForm(defaultAsset);
    setOpen(false);
  };

  const showFiiFields = isFiiTicker(form.ticker);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Ativo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono-display">Novo Ativo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ticker">Ticker</Label>
            <Input id="ticker" placeholder="HGLG11" value={form.ticker}
              onChange={(e) => onTickerChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantidade de Cotas</Label>
            <Input id="quantity" type="number" min={0} value={form.quantity || ""}
              onChange={(e) => set("quantity", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currentPrice">Valor Atual da Cota (R$)</Label>
            <Input id="currentPrice" type="number" step="0.01" value={form.currentPrice || ""}
              onChange={(e) => set("currentPrice", Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch checked={form.isManualPrice}
              onCheckedChange={(v) => set("isManualPrice", v)} />
            <Label className="text-xs text-muted-foreground">Preço manual</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="averagePrice">Preço Médio (R$)</Label>
            <Input id="averagePrice" type="number" step="0.01" value={form.averagePrice || ""}
              onChange={(e) => set("averagePrice", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalInvested">Total Investido (R$)</Label>
            <Input id="totalInvested" type="number" step="0.01" value={form.totalInvested || ""}
              onChange={(e) => set("totalInvested", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dividendYield">Dividend Yield (R$)</Label>
            <Input id="dividendYield" type="number" step="0.01" value={form.dividendYield || ""}
              onChange={(e) => set("dividendYield", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pvp">P/VP</Label>
            <Input id="pvp" type="number" step="0.01" value={form.pvp || ""}
              onChange={(e) => set("pvp", Number(e.target.value))} />
          </div>
          {showFiiFields && (
            <>
              <div className="space-y-1.5">
                <Label>Tipo (FII)</Label>
                <Select value={form.fiiType} onValueChange={(v) => set("fiiType", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {FII_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Segmento (FII)</Label>
                <Select value={form.fiiSegment} onValueChange={(v) => set("fiiSegment", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {FII_SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="col-span-2 flex justify-end pt-2">
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
