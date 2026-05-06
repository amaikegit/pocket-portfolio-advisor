import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FII_TYPES, FII_SEGMENTS, suggestClassification } from "@/lib/fiiClassification";
import { STOCK_SECTORS, STOCK_INDUSTRIES, suggestStockClassification } from "@/lib/stockClassification";
import { getAssetKind } from "@/lib/assetKind";

interface Props {
  ticker: string;
  currentType?: string | null;
  currentSegment?: string | null;
  onSave: (updates: { fiiType: string | null; fiiSegment: string | null }) => void;
  trigger: React.ReactNode;
}

/**
 * Unified classification dialog for both FIIs and stocks (ações).
 * Uses the same `fiiType` / `fiiSegment` columns as a generic
 * "type/segment" pair to avoid an extra schema migration.
 */
export function ClassifyAssetDialog({ ticker, currentType, currentSegment, onSave, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const kind = getAssetKind(ticker);
  const fiiSug = kind === "fii" ? suggestClassification(ticker) : null;
  const stockSug = kind === "stock" ? suggestStockClassification(ticker) : null;

  const initialType = currentType || (fiiSug?.type ?? stockSug?.sector ?? "");
  const initialSegment = currentSegment || (fiiSug?.segment ?? stockSug?.industry ?? "");

  const [type, setType] = useState<string>(initialType);
  const [segment, setSegment] = useState<string>(initialSegment);

  const typeOptions = kind === "fii" ? FII_TYPES : STOCK_SECTORS;
  const segmentOptions = kind === "fii" ? FII_SEGMENTS : STOCK_INDUSTRIES;
  const typeLabel = kind === "fii" ? "Tipo" : "Setor";
  const segmentLabel = kind === "fii" ? "Segmento" : "Subsetor / Indústria";

  const submit = () => {
    onSave({ fiiType: type || null, fiiSegment: segment || null });
    setOpen(false);
  };

  const sugLabel = kind === "fii"
    ? (fiiSug ? `${fiiSug.type} · ${fiiSug.segment}` : null)
    : (stockSug ? `${stockSug.sector} · ${stockSug.industry}` : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono-display">
            Classificar {ticker} <span className="text-xs text-muted-foreground">({kind === "fii" ? "FII" : "Ação"})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>{typeLabel}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{segmentLabel}</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {segmentOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {sugLabel && (
            <p className="text-[11px] text-muted-foreground">
              Sugestão automática: {sugLabel}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={submit}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}