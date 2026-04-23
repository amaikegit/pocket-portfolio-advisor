import { useState, useMemo } from "react";
import { Check, X, ArrowUpDown, ArrowUp, ArrowDown, Filter, Pencil, Trash2, BarChart3 } from "lucide-react";
import { Asset, AssetCalculated } from "@/types/portfolio";
import { StarRating } from "@/components/StarRating";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface PortfolioTableProps {
  assets: AssetCalculated[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Asset, "id">>) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number) => `${v.toFixed(2)}%`;

type SortDir = "asc" | "desc" | null;

interface ColumnDef {
  key: string;
  label: string;
  align: "left" | "right" | "center";
  accessor: (a: AssetCalculated) => number | string;
  filterable?: boolean;
}

const columns: ColumnDef[] = [
  { key: "ticker", label: "Ticker", align: "left", accessor: (a) => a.ticker, filterable: true },
  { key: "quantity", label: "Cotas", align: "right", accessor: (a) => a.quantity },
  { key: "currentPrice", label: "Atual", align: "right", accessor: (a) => a.currentPrice },
  { key: "totalCurrent", label: "Total", align: "right", accessor: (a) => a.totalCurrent },
  { key: "averagePrice", label: "PM", align: "right", accessor: (a) => a.averagePrice },
  { key: "totalInvested", label: "Investido", align: "right", accessor: (a) => a.totalInvested },
  { key: "difference", label: "Dif.", align: "right", accessor: (a) => a.difference },
  { key: "dividendYield", label: "DY", align: "right", accessor: (a) => a.dividendYield },
  { key: "pvp", label: "P/VP", align: "right", accessor: (a) => a.pvp },
  { key: "monthlyProfitability", label: "Rent.", align: "right", accessor: (a) => a.monthlyProfitability },
  { key: "priceVariation", label: "Var.", align: "right", accessor: (a) => a.priceVariation },
  { key: "rating", label: "Rating", align: "center", accessor: (a) => a.rating },
  { key: "portfolioProportion", label: "%Cart.", align: "right", accessor: (a) => a.portfolioProportion },
  { key: "totalVariationPerShare", label: "Var.Tot.", align: "right", accessor: (a) => a.totalVariationPerShare },
  { key: "buy", label: "Comprar?", align: "center", accessor: (a) => a.rating >= 3 ? 1 : 0 },
];

function ValueCell({ value, colored = false }: { value: number; colored?: boolean }) {
  const cls = colored
    ? value > 0 ? "text-positive" : value < 0 ? "text-negative" : ""
    : "";
  return <span className={`font-mono-display text-xs ${cls}`}>{fmt(value)}</span>;
}

function SortableHeader({
  col,
  sortKey,
  sortDir,
  onSort,
  filterValue,
  onFilter,
}: {
  col: ColumnDef;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  filterValue: string;
  onFilter: (key: string, value: string) => void;
}) {
  const isActive = sortKey === col.key;
  const hasFilter = filterValue.length > 0;

  return (
    <TableHead className="font-mono-display text-[10px] px-1.5 py-1.5 whitespace-nowrap">
      <div className={`flex items-center gap-0.5 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}>
        <button
          className="flex items-center gap-0.5 hover:text-primary transition-colors"
          onClick={() => onSort(col.key)}
        >
          {col.label}
          {isActive && sortDir === "asc" && <ArrowUp className="h-2.5 w-2.5 text-primary" />}
          {isActive && sortDir === "desc" && <ArrowDown className="h-2.5 w-2.5 text-primary" />}
          {!isActive && <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
        </button>
        {col.filterable !== false && (
          <Popover>
            <PopoverTrigger asChild>
              <button className={`ml-0.5 ${hasFilter ? "text-primary" : "opacity-30 hover:opacity-70"} transition-colors`}>
                <Filter className="h-2.5 w-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start">
              <Input
                placeholder={`Filtrar ${col.label}...`}
                value={filterValue}
                onChange={(e) => onFilter(col.key, e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1 h-6 text-xs"
                  onClick={() => onFilter(col.key, "")}
                >
                  Limpar
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
  );
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
      <TableCell className="px-1.5"><Input className="h-6 w-full text-xs font-semibold" value={form.ticker} onChange={(e) => set("ticker", e.target.value)} /></TableCell>
      <TableCell className="px-1.5"><Input className="h-6 w-full text-xs text-right" type="number" min={0} value={form.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value))} /></TableCell>
      <TableCell className="px-1.5"><Input className="h-6 w-full text-xs text-right" type="number" step="0.01" value={form.currentPrice || ""} onChange={(e) => set("currentPrice", Number(e.target.value))} /></TableCell>
      <TableCell className="text-right px-1.5"><span className="font-mono-display text-xs text-muted-foreground">{fmt(form.quantity * form.currentPrice)}</span></TableCell>
      <TableCell className="px-1.5"><Input className="h-6 w-full text-xs text-right" type="number" step="0.01" value={form.averagePrice || ""} onChange={(e) => set("averagePrice", Number(e.target.value))} /></TableCell>
      <TableCell className="px-1.5"><Input className="h-6 w-full text-xs text-right" type="number" step="0.01" value={form.totalInvested || ""} onChange={(e) => set("totalInvested", Number(e.target.value))} /></TableCell>
      <TableCell className="text-right px-1.5"><span className="font-mono-display text-xs text-muted-foreground">—</span></TableCell>
      <TableCell className="px-1.5"><Input className="h-6 w-full text-xs text-right" type="number" step="0.01" value={form.dividendYield || ""} onChange={(e) => set("dividendYield", Number(e.target.value))} /></TableCell>
      <TableCell className="px-1.5"><Input className="h-6 w-full text-xs text-right" type="number" step="0.01" value={form.pvp || ""} onChange={(e) => set("pvp", Number(e.target.value))} /></TableCell>
      <TableCell colSpan={4} className="text-center text-muted-foreground text-[10px] px-1.5">Campos calculados atualizarão ao salvar</TableCell>
      <TableCell className="px-1.5">
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-positive hover:text-positive" onClick={handleSave}><Check className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-negative" onClick={onCancel}><X className="h-3 w-3" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TableSummaryHeader({ assets }: { assets: AssetCalculated[] }) {
  const totalValue = assets.reduce((s, a) => s + a.totalCurrent, 0);
  const totalInvested = assets.reduce((s, a) => s + a.totalInvested, 0);
  const variation = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const avgProfitability = assets.length > 0 ? assets.reduce((s, a) => s + a.monthlyProfitability, 0) / assets.length : 0;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono-display font-bold text-sm sm:text-base">Meus Ativos</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-xs sm:text-sm">
          <div className="text-center">
            <p className="text-muted-foreground text-[10px] sm:text-xs">Ativos</p>
            <p className="font-mono-display font-semibold">{assets.length}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-[10px] sm:text-xs">Valor total</p>
            <p className="font-mono-display font-semibold">{fmt(totalValue)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-[10px] sm:text-xs">Variação</p>
            <p className={`font-mono-display font-semibold ${variation > 0 ? "text-positive" : variation < 0 ? "text-negative" : ""}`}>
              {pct(variation)} {variation > 0 ? "▲" : variation < 0 ? "▼" : ""}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-[10px] sm:text-xs">Rentabilidade</p>
            <p className={`font-mono-display font-semibold ${avgProfitability > 0 ? "text-positive" : ""}`}>
              {pct(avgProfitability)} ↗
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-[10px] sm:text-xs">% na carteira</p>
            <p className="font-mono-display font-semibold">100%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortfolioTable({ assets, onRemove, onUpdate }: PortfolioTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const activeFilters = Object.keys(filters).filter((k) => filters[k]?.length > 0).length;

  const processed = useMemo(() => {
    let result = [...assets];

    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      const lower = value.toLowerCase();
      result = result.filter((a) => {
        const v = col.accessor(a);
        return String(v).toLowerCase().includes(lower);
      });
    }

    if (sortKey && sortDir) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        result.sort((a, b) => {
          const va = col.accessor(a);
          const vb = col.accessor(b);
          const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [assets, filters, sortKey, sortDir]);

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="font-mono-display text-lg">Nenhum ativo na carteira</p>
        <p className="text-sm mt-1">Adicione ativos ou importe um CSV para começar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <TableSummaryHeader assets={assets} />
      {activeFilters > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>{activeFilters} filtro(s) ativo(s) — {processed.length} de {assets.length} ativos</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFilters({})}>
            Limpar todos
          </Button>
        </div>
      )}
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table className="min-w-[900px] w-full">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((col) => (
                <SortableHeader
                  key={col.key}
                  col={col}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  filterValue={filters[col.key] || ""}
                  onFilter={handleFilter}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.map((a) =>
              editingId === a.id ? (
                <EditableRow
                  key={a.id}
                  asset={a}
                  onSave={(updates) => { onUpdate(a.id, updates); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="px-1.5 py-1.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="font-mono-display font-semibold text-primary text-xs hover:underline cursor-pointer">
                          {a.ticker}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-36 p-1" align="start">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-8 text-xs"
                          onClick={() => setEditingId(a.id)}
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => onRemove(a.id)}
                        >
                          <Trash2 className="h-3 w-3" /> Excluir
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell className="text-right font-mono-display text-xs px-1.5 py-1.5">{a.quantity}</TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.currentPrice} /></TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.totalCurrent} /></TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.averagePrice} /></TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.totalInvested} /></TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.difference} colored /></TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.dividendYield} /></TableCell>
                  <TableCell className={`text-right font-mono-display text-xs px-1.5 py-1.5 ${a.pvp > 1 ? "text-negative" : ""}`}>{a.pvp.toFixed(2)}</TableCell>
                  <TableCell className="text-right px-1.5 py-1.5">
                    <span className={`font-mono-display text-xs ${a.monthlyProfitability > 0.8 ? "text-positive" : "text-muted-foreground"}`}>
                      {pct(a.monthlyProfitability)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.priceVariation} colored /></TableCell>
                  <TableCell className="text-center px-1.5 py-1.5"><StarRating rating={a.rating} breakdown={a.ratingBreakdown} /></TableCell>
                  <TableCell className="text-right font-mono-display text-xs px-1.5 py-1.5">{pct(a.portfolioProportion)}</TableCell>
                  <TableCell className="text-right px-1.5 py-1.5"><ValueCell value={a.totalVariationPerShare} colored /></TableCell>
                  <TableCell className="text-center px-1.5 py-1.5">
                    <span className={`font-mono-display text-xs font-semibold ${a.rating >= 4 ? "text-positive" : "text-negative"}`}>
                      {a.rating >= 4 ? "Sim" : "Não"}
                    </span>
                  </TableCell>
                </TableRow>
              )
            )}
            {processed.length === 0 && (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum ativo corresponde aos filtros aplicados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
