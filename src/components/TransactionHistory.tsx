import { useState, useMemo } from "react";
import { Trash2, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Transaction } from "@/types/portfolio";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const assetTypeLabels: Record<string, string> = {
  acoes: "Ações",
  fiis: "FIIs",
  bdrs: "BDRs",
  etfs: "ETFs",
  cripto: "Cripto",
};

type SortDir = "asc" | "desc" | null;

interface Props {
  transactions: Transaction[];
  onRemove: (id: string) => void;
}

export function TransactionHistory({ transactions, onRemove }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let data = [...transactions];
    for (const [key, val] of Object.entries(filters)) {
      if (!val) continue;
      const lower = val.toLowerCase();
      data = data.filter((t) => {
        const v = (t as any)[key];
        return String(v).toLowerCase().includes(lower);
      });
    }
    if (sortKey && sortDir) {
      data.sort((a, b) => {
        const va = (a as any)[sortKey];
        const vb = (b as any)[sortKey];
        const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else {
      // Default: newest first
      data.sort((a, b) => b.date.localeCompare(a.date));
    }
    return data;
  }, [transactions, filters, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const columns = [
    { key: "date", label: "Data" },
    { key: "type", label: "Tipo" },
    { key: "assetType", label: "Tipo Ativo" },
    { key: "ticker", label: "Ticker" },
    { key: "quantity", label: "Qtd" },
    { key: "price", label: "Preço" },
    { key: "otherCosts", label: "Custos" },
    { key: "total", label: "Total" },
  ];

  if (transactions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-mono-display font-bold text-sm">Histórico de Lançamentos</h2>
        <p className="text-xs text-muted-foreground">{transactions.length} lançamento(s)</p>
      </div>
      <div className="overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="bg-muted/30">
              {columns.map((col) => (
                <TableHead key={col.key} className="px-2 py-1.5 text-[11px]">
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-foreground">
                      {col.label} <SortIcon col={col.key} />
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="hover:text-foreground">
                          <Filter className={`h-3 w-3 ${filters[col.key] ? "text-primary" : "opacity-40"}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-2" align="start">
                        <Input
                          placeholder="Filtrar..."
                          value={filters[col.key] || ""}
                          onChange={(e) => setFilters((f) => ({ ...f, [col.key]: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
              ))}
              <TableHead className="px-2 py-1.5 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tx) => (
              <TableRow key={tx.id} className="text-xs">
                <TableCell className="px-2 py-1.5">{fmtDate(tx.date)}</TableCell>
                <TableCell className="px-2 py-1.5">
                  <Badge variant={tx.type === "buy" ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                    {tx.type === "buy" ? "Compra" : "Venda"}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 py-1.5">{assetTypeLabels[tx.assetType] || tx.assetType}</TableCell>
                <TableCell className="px-2 py-1.5 font-mono font-medium">{tx.ticker}</TableCell>
                <TableCell className="px-2 py-1.5 text-right">{tx.quantity}</TableCell>
                <TableCell className="px-2 py-1.5 text-right">{fmt(tx.price)}</TableCell>
                <TableCell className="px-2 py-1.5 text-right">{fmt(tx.otherCosts)}</TableCell>
                <TableCell className="px-2 py-1.5 text-right font-medium">{fmt(tx.total)}</TableCell>
                <TableCell className="px-2 py-1.5">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso removerá o lançamento de {tx.type === "buy" ? "compra" : "venda"} de {tx.quantity}x {tx.ticker} e recalculará o ativo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemove(tx.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6 text-muted-foreground text-xs">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
