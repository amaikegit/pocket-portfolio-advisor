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

interface Props {
  ticker: string;
  currentType?: string | null;
  currentSegment?: string | null;
  onSave: (updates: { fiiType: string | null; fiiSegment: string | null }) => void;
  trigger: React.ReactNode;
}

export function ClassifyFiiDialog({ ticker, currentType, currentSegment, onSave, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const sug = suggestClassification(ticker);
  const [type, setType] = useState<string>(currentType || sug?.type || "");
  const [segment, setSegment] = useState<string>(currentSegment || sug?.segment || "");

  const submit = () => {
    onSave({ fiiType: type || null, fiiSegment: segment || null });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono-display">Classificar {ticker}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {FII_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {FII_SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {sug && (
            <p className="text-[11px] text-muted-foreground">
              Sugestão automática: {sug.type} · {sug.segment}
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
