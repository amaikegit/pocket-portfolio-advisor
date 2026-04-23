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

interface CSVImportDialogProps {
  onImport: (csv: string) => number | Promise<number>;
  trigger?: React.ReactNode;
}

export function CSVImportDialog({ onImport, trigger }: CSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const count = onImport(text);
      setResult(`${count} ativo(s) importado(s) com sucesso!`);
      setTimeout(() => {
        setOpen(false);
        setResult(null);
      }, 1500);
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono-display">Importar CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O arquivo CSV deve usar <code className="text-primary font-mono-display">;</code> como separador e conter as colunas:
          </p>
          <div className="rounded-md bg-muted p-3 font-mono-display text-xs text-muted-foreground">
            ticker;quantidade;preco_atual;preco_medio;total_investido;dy;pvp
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2 w-full"
            onClick={() => {
              const template = "ticker;quantidade;preco_atual;preco_medio;total_investido;dy;pvp\nHGLG11;10;160.50;155.00;1550.00;1.20;0.95\n";
              const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "modelo_carteira.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
            Baixar modelo CSV
          </Button>
          {result && (
            <p className="text-sm text-positive font-medium">{result}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
