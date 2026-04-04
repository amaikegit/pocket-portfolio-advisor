import { useState, useMemo } from "react";
import { Trash2, Pencil, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
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
  { key: "currentPrice", label: "Valor Atual", align: "right", accessor: (a) => a.currentPrice },
  { key: "totalCurrent", label: "Total Atual", align: "right", accessor: (a) => a.totalCurrent },
  { key: "averagePrice", label: "Preço Médio", align: "right", accessor: (a) => a.averagePrice },
  { key: "totalInvested", label: "Total Investido", align: "right", accessor: (a) => a.totalInvested },
  { key: "difference", label: "Diferença", align: "right", accessor: (a) => a.difference },
  { key: "dividendYield", label: "DY (R$)", align: "right", accessor: (a) => a.dividendYield },
  { key: "pvp", label: "P/VP", align: "right", accessor: (a) => a.pvp },
  { key: "monthlyProfitability", label: "Rent. Mensal", align: "right", accessor: (a) => a.monthlyProfitability },
  { key: "priceVariation", label: "Var. Cota", align: "right", accessor: (a) => a.priceVariation },
  { key: "rating", label: "Rating", align: "center", accessor: (a) => a.rating },
  { key: "portfolioProportion", label: "% Carteira", align: "right", accessor: (a) => a.portfolioProportion },
  { key: "totalVariationPerShare", label: "Var. Total", align: "right", accessor: (a) => a.totalVariationPerShare },
];

function ValueCell({ value, colored = false }: { value: number; colored?: boolean }) {
  const cls = colored
    ? value > 0 ? "text-positive" : value < 0 ? "text-negative" : ""
    : "";
  return <span className={`font-mono-display text-sm ${cls}`}>{fmt(value)}</span>;
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
    <TableHead className={`font-mono-display text-xs text-${col.align}`}>
      <div className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}>
        <button
          className="flex items-center gap-0.5 hover:text-primary transition-colors"
          onClick={() => onSort(col.key)}
        >
          {col.label}
          {isActive && sortDir === "asc" && <ArrowUp className="h-3 w-3 text-primary" />}
          {isActive && sortDir === "desc" && <ArrowDown className="h-3 w-3 text-primary" />}
          {!isActive && <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </button>
        {col.filterable !== false && (
          <Popover>
            <PopoverTrigger asChild>
              <button className={`ml-0.5 ${hasFilter ? "text-primary" : "opacity-30 hover:opacity-70"} transition-colors`}>
                <Filter className="h-3 w-3" />
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
      <TableCell><Input className="h-7 w-20 text-xs font-semibold" value={form.ticker} onChange={(e) => set("ticker", e.target.value)} /></TableCell>
      <TableCell><Input className="h-7 w-16 text-xs text-right" type="number" min={0} value={form.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value))} /></TableCell>
      <TableCell><Input className="h-7 w-20 text-xs text-right" type="number" step="0.01" value={form.currentPrice || ""} onChange={(e) => set("currentPrice", Number(e.target.value))} /></TableCell>
      <TableCell className="text-right"><span className="font-mono-display text-sm text-muted-foreground">{fmt(form.quantity * form.currentPrice)}</span></TableCell>
      <TableCell><Input className="h-7 w-20 text-xs text-right" type="number" step="0.01" value={form.averagePrice || ""} onChange={(e) => set("averagePrice", Number(e.target.value))} /></TableCell>
      <TableCell><Input className="h-7 w-24 text-xs text-right" type="number" step="0.01" value={form.totalInvested || ""} onChange={(e) => set("totalInvested", Number(e.target.value))} /></TableCell>
      <TableCell className="text-right"><span className="font-mono-display text-sm text-muted-foreground">—</span></TableCell>
      <TableCell><Input className="h-7 w-20 text-xs text-right" type="number" step="0.01" value={form.dividendYield || ""} onChange={(e) => set("dividendYield", Number(e.target.value))} /></TableCell>
      <TableCell><Input className="h-7 w-16 text-xs text-right" type="number" step="0.01" value={form.pvp || ""} onChange={(e) => set("pvp", Number(e.target.value))} /></TableCell>
      <TableCell colSpan={4} className="text-center text-muted-foreground text-xs">Campos calculados serão atualizados ao salvar</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-positive hover:text-positive" onClick={handleSave}><Check className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-negative" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </TableCell>
    </TableRow>
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

    // Apply filters
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

    // Apply sort
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
      {activeFilters > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>{activeFilters} filtro(s) ativo(s) — {processed.length} de {assets.length} ativos</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFilters({})}>
            Limpar todos
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
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
              <TableHead className="font-mono-display text-xs w-16"></TableHead>
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
                  <TableCell className="font-mono-display font-semibold text-primary">{a.ticker}</TableCell>
                  <TableCell className="text-right font-mono-display text-sm">{a.quantity}</TableCell>
                  <TableCell className="text-right"><ValueCell value={a.currentPrice} /></TableCell>
                  <TableCell className="text-right"><ValueCell value={a.totalCurrent} /></TableCell>
                  <TableCell className="text-right"><ValueCell value={a.averagePrice} /></TableCell>
                  <TableCell className="text-right"><ValueCell value={a.totalInvested} /></TableCell>
                  <TableCell className="text-right"><ValueCell value={a.difference} colored /></TableCell>
                  <TableCell className="text-right"><ValueCell value={a.dividendYield} /></TableCell>
                  <TableCell className="text-right font-mono-display text-sm">{a.pvp.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono-display text-sm ${a.monthlyProfitability > 0.8 ? "text-positive" : "text-muted-foreground"}`}>
                      {pct(a.monthlyProfitability)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right"><ValueCell value={a.priceVariation} colored /></TableCell>
                  <TableCell className="text-center"><StarRating rating={a.rating} /></TableCell>
                  <TableCell className="text-right font-mono-display text-sm">{pct(a.portfolioProportion)}</TableCell>
                  <TableCell className="text-right"><ValueCell value={a.totalVariationPerShare} colored /></TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditingId(a.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-negative" onClick={() => onRemove(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
            {processed.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} className="text-center py-8 text-muted-foreground text-sm">
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
