import { useState, useRef } from "react";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DividendInput } from "@/hooks/useDividends";
import { todayISOInBRT } from "@/lib/brt";

interface CSVImportDividendsDialogProps {
  onImport: (dividends: DividendInput[]) => Promise<number>;
}

export function CSVImportDividendsDialog({ onImport }: CSVImportDividendsDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.trim().split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          setResult("Arquivo vazio ou sem dados.");
          setImporting(false);
          return;
        }

        const dividends: DividendInput[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(";").map((c) => c.trim());
          if (cols.length < 4) continue;
          const [ticker, amount, month, year, date] = cols;
          const parsedAmount = parseFloat(amount.replace(",", "."));
          const parsedMonth = parseInt(month);
          const parsedYear = parseInt(year);
          if (!ticker || isNaN(parsedAmount) || isNaN(parsedMonth) || isNaN(parsedYear)) continue;
          dividends.push({
            ticker: ticker.toUpperCase(),
            amount: parsedAmount,
            month: parsedMonth,
            year: parsedYear,
            payment_date: date || todayISOInBRT(),
          });
        }

        const count = await onImport(dividends);
        setResult(`${count} dividendo(s) importado(s) com sucesso!`);
        setTimeout(() => {
          setOpen(false);
          setResult(null);
        }, 1500);
      } catch {
        setResult("Erro ao processar o arquivo.");
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Importar CSV</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono-display">Importar Dividendos CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O arquivo CSV deve usar <code className="text-primary font-mono-display">;</code> como separador e conter as colunas:
          </p>
          <div className="rounded-md bg-muted p-3 font-mono-display text-xs text-muted-foreground">
            ticker;valor;mes;ano;data_pagamento
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            disabled={importing}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2 w-full"
            onClick={() => {
              const template = "ticker;valor;mes;ano;data_pagamento\nMXRF11;0.85;1;2025;2025-01-15\nHGLG11;1.10;1;2025;2025-01-15\n";
              const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "modelo_dividendos.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
            Baixar modelo CSV
          </Button>
          {result && (
            <p className="text-sm text-primary font-medium">{result}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
