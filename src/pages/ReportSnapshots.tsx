import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ArrowDownRight, ArrowUpRight, Minus, Loader2, History, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPageByCreatedAtDesc } from "@/lib/supabasePagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";

interface ReportSnapshot {
  id: string;
  report_id: string | null;
  report_type: string;
  total_current: number;
  total_invested: number;
  rentabilidade_pct: number;
  dividends_week_total: number;
  dividends_week_count: number;
  previous_snapshot_id: string | null;
  delta_current: number | null;
  delta_rentabilidade_pct: number | null;
  delta_dividends_week: number | null;
  created_at: string;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

function DeltaBadge({ value, type }: { value: number | null; type: "currency" | "pct" }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Minus className="h-3 w-3" />—</span>;
  }
  const positive = value > 0;
  const negative = value < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const color = positive ? "text-emerald-500" : negative ? "text-destructive" : "text-muted-foreground";
  const label = type === "currency"
    ? `${positive ? "+" : ""}${fmtBRL(value)}`
    : fmtPct(value);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", color)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

const ReportSnapshots = () => {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [reportType, setReportType] = useState<string>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 50;

  const load = async () => {
    setLoading(true);
    try {
      const { rows, nextCursor } = await fetchPageByCreatedAtDesc<ReportSnapshot>(
        "report_snapshots", "*", undefined, null, PAGE_SIZE,
      );
      setSnapshots(rows);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch {
      toast.error("Erro ao carregar snapshots.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { rows, nextCursor } = await fetchPageByCreatedAtDesc<ReportSnapshot>(
        "report_snapshots", "*", undefined, cursor, PAGE_SIZE,
      );
      setSnapshots((prev) => [...prev, ...rows]);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch {
      toast.error("Erro ao carregar mais snapshots.");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return snapshots.filter((s) => {
      const d = new Date(s.created_at);
      if (from && d < from) return false;
      if (to) {
        const end = new Date(to); end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      if (reportType !== "all" && s.report_type !== reportType) return false;
      return true;
    });
  }, [snapshots, from, to, reportType]);

  const summary = useMemo(() => {
    if (filtered.length < 2) return null;
    const newest = filtered[0];
    const oldest = filtered[filtered.length - 1];
    return {
      count: filtered.length,
      currentDelta: Number(newest.total_current) - Number(oldest.total_current),
      pctDelta: Number(newest.rentabilidade_pct) - Number(oldest.rentabilidade_pct),
      dividendsSum: filtered.reduce((s, x) => s + Number(x.dividends_week_total || 0), 0),
    };
  }, [filtered]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("report_snapshots").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else {
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      toast.success("Snapshot excluído.");
    }
  };

  const clearFilters = () => { setFrom(undefined); setTo(undefined); setReportType("all"); };

  return (
    <AppLayout
      title={
        <span className="inline-flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Histórico de Snapshots
        </span>
      }
    >
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-mono-display">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">De</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !from && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {from ? format(from, "PPP", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={from} onSelect={setFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Até</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !to && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {to ? format(to, "PPP", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={to} onSelect={setTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
          </CardContent>
        </Card>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Snapshots</div>
                <div className="text-2xl font-mono-display font-semibold">{summary.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Variação Patrimônio (período)</div>
                <div className="text-lg font-mono-display font-semibold"><DeltaBadge value={summary.currentDelta} type="currency" /></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Variação Rentabilidade %</div>
                <div className="text-lg font-mono-display font-semibold"><DeltaBadge value={summary.pctDelta} type="pct" /></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Dividendos somados</div>
                <div className="text-lg font-mono-display font-semibold">{fmtBRL(summary.dividendsSum)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-mono-display flex items-center gap-2">
              Snapshots
              <Badge variant="secondary">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum snapshot encontrado para os filtros atuais.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Patrimônio</TableHead>
                      <TableHead className="text-right">Δ Patrimônio</TableHead>
                      <TableHead className="text-right">Rentab. %</TableHead>
                      <TableHead className="text-right">Δ Rentab.</TableHead>
                      <TableHead className="text-right">Dividendos semana</TableHead>
                      <TableHead className="text-right">Δ Dividendos</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.report_type === "weekly" ? "default" : "outline"} className="text-[10px] h-4">
                            {s.report_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmtBRL(Number(s.total_current))}</TableCell>
                        <TableCell className="text-right"><DeltaBadge value={s.delta_current} type="currency" /></TableCell>
                        <TableCell className="text-right font-mono">{fmtPct(Number(s.rentabilidade_pct))}</TableCell>
                        <TableCell className="text-right"><DeltaBadge value={s.delta_rentabilidade_pct} type="pct" /></TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtBRL(Number(s.dividends_week_total))}
                          <span className="text-[10px] text-muted-foreground ml-1">({s.dividends_week_count})</span>
                        </TableCell>
                        <TableCell className="text-right"><DeltaBadge value={s.delta_dividends_week} type="currency" /></TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="gap-2">
                      {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Carregar mais
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ReportSnapshots;