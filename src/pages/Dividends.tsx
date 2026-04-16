import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDividends, Dividend, DividendInput } from "@/hooks/useDividends";
import { CSVImportDividendsDialog } from "@/components/CSVImportDividendsDialog";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, Plus, ArrowLeft, LogOut, DollarSign, TrendingUp, Calendar, Loader2, Trash2, Pencil, Filter, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

import { AccumulatedDividendsChart } from "@/components/dividends/AccumulatedDividendsChart";
import { AssetDividendEvolution } from "@/components/dividends/AssetDividendEvolution";
import { DividendAnalytics } from "@/components/dividends/DividendAnalytics";
import { InvestmentCalculator } from "@/components/dividends/InvestmentCalculator";
import { MonthlyGoal } from "@/components/dividends/MonthlyGoal";
import { DividendProjections } from "@/components/dividends/DividendProjections";

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Dividends = () => {
  const {
    dividends, loading, addDividend, updateDividend, bulkImportDividends, removeDividend, bulkRemoveDividends,
    years, monthlyByYear, totalByYear, totalAll, averageMonthly,
  } = useDividends();
  const { assets, calculatedAssets } = usePortfolio();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);
  const [form, setForm] = useState({ ticker: "", amount: "", month: "", year: "", date: "" });
  const [filterYear, setFilterYear] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [paidTableOpen, setPaidTableOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const existingTickers = assets.map((a) => a.ticker).sort();

  const resetForm = () => setForm({
    ticker: "",
    amount: "",
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString(),
    date: new Date().toISOString().slice(0, 10),
  });

  // Last dividend amount per ticker for hint
  const lastDividendByTicker = (ticker: string): number | null => {
    const tickerDivs = dividends.filter((d) => d.ticker === ticker).sort((a, b) => b.year - a.year || b.month - a.month);
    return tickerDivs.length > 0 ? tickerDivs[0].amount : null;
  };
  const lastAmountHint = form.ticker ? lastDividendByTicker(form.ticker) : null;

  const handleAdd = async () => {
    if (!form.ticker || !form.amount || !form.month || !form.year) return;
    await addDividend({
      ticker: form.ticker,
      amount: parseFloat(form.amount.replace(",", ".")),
      payment_date: form.date || new Date().toISOString().slice(0, 10),
      month: parseInt(form.month),
      year: parseInt(form.year),
    });
    resetForm();
    setOpen(false);
  };

  const handleEditOpen = (d: Dividend) => {
    setEditingDividend(d);
    setForm({
      ticker: d.ticker,
      amount: d.amount.toString().replace(".", ","),
      month: d.month.toString(),
      year: d.year.toString(),
      date: d.payment_date,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingDividend || !form.ticker || !form.amount || !form.month || !form.year) return;
    await updateDividend(editingDividend.id, {
      ticker: form.ticker,
      amount: parseFloat(form.amount.replace(",", ".")),
      payment_date: form.date || editingDividend.payment_date,
      month: parseInt(form.month),
      year: parseInt(form.year),
    });
    resetForm();
    setEditingDividend(null);
    setEditOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredDividends = filterYear === "all"
    ? dividends
    : dividends.filter((d) => d.year === parseInt(filterYear));

  const sortedDividends = [...filteredDividends].sort((a, b) => b.year - a.year || b.month - a.month);

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedDividends.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedDividends.map((d) => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    await bulkRemoveDividends(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const grid = monthlyByYear();
  const displayYears = years.length > 0 ? years : [currentYear];

  const barData = MONTH_NAMES.map((m, i) => {
    const row: any = { month: m };
    for (const y of displayYears) row[y] = grid[y]?.[i + 1] || 0;
    return row;
  });

  const lineData = displayYears.map((y) => ({ year: y.toString(), total: totalByYear(y) }));

  const PIE_COLORS = ["hsl(142, 60%, 45%)", "hsl(38, 90%, 55%)", "hsl(200, 70%, 50%)", "hsl(280, 60%, 55%)", "hsl(0, 70%, 50%)", "hsl(170, 60%, 45%)", "hsl(320, 60%, 55%)", "hsl(60, 80%, 45%)"];
  const pieData = Object.entries(
    dividends.reduce<Record<string, number>>((acc, d) => {
      acc[d.ticker] = (acc[d.ticker] || 0) + d.amount;
      return acc;
    }, {})
  ).map(([ticker, total]) => ({ ticker, total })).sort((a, b) => b.total - a.total);

  const chartConfig: Record<string, { label: string; color: string }> = {};
  const colors = ["hsl(142, 60%, 45%)", "hsl(38, 90%, 55%)", "hsl(200, 70%, 50%)", "hsl(280, 60%, 55%)", "hsl(0, 70%, 50%)"];
  displayYears.forEach((y, i) => {
    chartConfig[y] = { label: y.toString(), color: colors[i % colors.length] };
  });

  // Comparison: current year only
  const compData = (() => {
    const monthTotals: Record<string, number> = {};
    dividends.forEach((d) => {
      const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
      monthTotals[key] = (monthTotals[key] || 0) + d.amount;
    });

    return MONTH_NAMES.map((name, i) => {
      const monthNum = i + 1;
      const keyCurrent = `${currentYear}-${String(monthNum).padStart(2, "0")}`;
      const keyPrev = monthNum === 1
        ? `${currentYear - 1}-12`
        : `${currentYear}-${String(monthNum - 1).padStart(2, "0")}`;
      const atual = monthTotals[keyCurrent] || 0;
      const anterior = monthTotals[keyPrev] || 0;
      const diff = atual - anterior;
      const diffPct = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
      return {
        label: name,
        atual,
        anterior,
        diff: parseFloat(diff.toFixed(2)),
        diffPct: parseFloat(diffPct.toFixed(1)),
      };
    }).filter((d) => d.atual > 0 || d.anterior > 0);
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const formFieldsJSX = (
    <div className="space-y-3 pt-2">
      <div>
        <label className="text-sm text-muted-foreground">Ticker</label>
        {existingTickers.length > 0 ? (
          <Select value={form.ticker} onValueChange={(v) => setForm((f) => ({ ...f, ticker: v }))}>
            <SelectTrigger><SelectValue placeholder="Selecione o ativo" /></SelectTrigger>
            <SelectContent>
              {existingTickers.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input placeholder="Ex: MXRF11" value={form.ticker} onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))} />
        )}
      </div>
      <div>
        <label className="text-sm text-muted-foreground">Valor (R$)</label>
        <Input placeholder="0,00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        {lastAmountHint !== null && !form.amount && (
          <p className="text-xs text-muted-foreground mt-1">Último valor: {formatBRL(lastAmountHint)}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted-foreground">Mês</label>
          <Select value={form.month} onValueChange={(v) => setForm((f) => ({ ...f, month: v }))}>
            <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>{m.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Ano</label>
          <Input type="number" placeholder={currentYear.toString()} value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground">Data do Pagamento</label>
        <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-primary/20 flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            <h1 className="font-mono-display text-base sm:text-lg font-bold tracking-tight">
              Portfolio<span className="text-primary">Tracker</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <CSVImportDividendsDialog onImport={bulkImportDividends} />
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Adicionar Dividendo</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Dividendo</DialogTitle>
                </DialogHeader>
                {formFieldsJSX}
                <Button className="w-full" onClick={handleAdd}>Salvar</Button>
              </DialogContent>
            </Dialog>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { resetForm(); setEditingDividend(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Dividendo</DialogTitle>
          </DialogHeader>
          {formFieldsJSX}
          <Button className="w-full" onClick={handleEditSave}>Atualizar</Button>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Summary Cards */}
        {(() => {
          const currentMonth = new Date().getMonth() + 1;
          const currentMonthTotal = dividends
            .filter((d) => d.year === currentYear && d.month === currentMonth)
            .reduce((s, d) => s + d.amount, 0);
          return (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Total Recebido
                  </div>
                  <p className="text-lg sm:text-xl font-mono font-bold text-primary">{formatBRL(totalAll)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Média Mensal
                  </div>
                  <p className="text-lg sm:text-xl font-mono font-bold">{formatBRL(averageMonthly())}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Ano Atual ({currentYear})
                  </div>
                  <p className="text-lg sm:text-xl font-mono font-bold">{formatBRL(totalByYear(currentYear))}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Ativos Pagando
                  </div>
                  <p className="text-lg sm:text-xl font-mono font-bold">{new Set(dividends.map((d) => d.ticker)).size}</p>
                </CardContent>
              </Card>
              <MonthlyGoal currentMonthTotal={currentMonthTotal} />
            </div>
          );
        })()}

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono">Dividendos Mensais por Ano</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} />} />
                  {displayYears.map((y) => (
                    <Bar key={y} dataKey={y} fill={chartConfig[y]?.color} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono">Evolução Anual</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ total: { label: "Total", color: "hsl(142, 60%, 45%)" } }} className="h-[280px] w-full">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `R$${v}`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} />} />
                  <Line type="monotone" dataKey="total" stroke="hsl(142, 60%, 45%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Accumulated Chart */}
        <AccumulatedDividendsChart dividends={dividends} />

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono">Distribuição por Ativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <ChartContainer config={{ total: { label: "Total", color: "hsl(142,60%,45%)" } }} className="h-[280px] w-full lg:w-1/2">
                  <PieChart>
                    <Pie data={pieData} dataKey="total" nameKey="ticker" cx="50%" cy="50%" outerRadius={100} label={({ ticker, percent }) => `${ticker} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} />} />
                  </PieChart>
                </ChartContainer>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full lg:w-1/2">
                  {pieData.map((item, i) => (
                    <div key={item.ticker} className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="font-mono font-medium">{item.ticker}</span>
                      <span className="text-muted-foreground ml-auto">{formatBRL(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparison - Current Year */}
        {compData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Comparativo Mês a Mês — {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  atual: { label: "Mês Atual", color: "hsl(142, 60%, 45%)" },
                  anterior: { label: "Mês Anterior", color: "hsl(215, 15%, 50%)" },
                }}
                className="h-[300px] w-full"
              >
                <BarChart data={compData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => formatBRL(Number(value))}
                        labelFormatter={(label, payload) => {
                          if (payload?.[0]?.payload) {
                            const p = payload[0].payload;
                            const sign = p.diff >= 0 ? "+" : "";
                            return `${label} (${sign}${formatBRL(p.diff)} / ${sign}${p.diffPct}%)`;
                          }
                          return label;
                        }}
                      />
                    }
                  />
                  <Legend />
                  <Bar dataKey="anterior" name="Mês Anterior" fill="hsl(215, 15%, 50%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="atual" name="Mês Atual" fill="hsl(142, 60%, 45%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Per-asset evolution */}
        <AssetDividendEvolution dividends={dividends} />

        {/* Analytics */}
        <DividendAnalytics dividends={dividends} assets={calculatedAssets} />

        {/* Projections */}
        <DividendProjections dividends={dividends} assets={calculatedAssets} rawAssets={assets} />

        {/* Monthly Table - Collapsible */}
        <Collapsible open={paidTableOpen} onOpenChange={setPaidTableOpen}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-sm font-mono uppercase hover:text-primary transition-colors">
                  {paidTableOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Dividendos Pagos
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs sticky left-0 bg-card z-10">Mês</TableHead>
                        {displayYears.map((y) => (
                          <TableHead key={y} className="font-mono text-xs text-right">{y}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MONTH_NAMES.map((m, i) => (
                        <TableRow key={m}>
                          <TableCell className="font-mono text-xs sticky left-0 bg-card z-10">{m}</TableCell>
                          {displayYears.map((y) => {
                            const val = grid[y]?.[i + 1];
                            return (
                              <TableCell key={y} className="font-mono text-xs text-right">
                                {val ? formatBRL(val) : ""}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-primary/30 font-bold">
                        <TableCell className="font-mono text-xs sticky left-0 bg-card z-10">Total</TableCell>
                        {displayYears.map((y) => (
                          <TableCell key={y} className="font-mono text-xs text-right text-primary font-bold">
                            {formatBRL(totalByYear(y))}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Collapsible Individual Records */}
        {dividends.length > 0 && (
          <Collapsible open={recordsOpen} onOpenChange={setRecordsOpen}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-mono uppercase hover:text-primary transition-colors">
                      {recordsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Registros Individuais ({filteredDividends.length})
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleBulkDelete}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir {selectedIds.size}
                      </Button>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select value={filterYear} onValueChange={(v) => { setFilterYear(v); setSelectedIds(new Set()); }}>
                        <SelectTrigger className="h-8 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {years.map((y) => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center">
                            <Checkbox
                              checked={sortedDividends.length > 0 && selectedIds.size === sortedDividends.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="font-mono text-xs">Ticker</TableHead>
                          <TableHead className="font-mono text-xs text-right">Valor</TableHead>
                          <TableHead className="font-mono text-xs text-center">Mês/Ano</TableHead>
                          <TableHead className="font-mono text-xs text-center">Data Pgto</TableHead>
                          <TableHead className="font-mono text-xs text-center w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedDividends.map((d) => (
                          <TableRow key={d.id} className={selectedIds.has(d.id) ? "bg-muted/50" : ""}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedIds.has(d.id)}
                                onCheckedChange={() => toggleSelect(d.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-medium">{d.ticker}</TableCell>
                            <TableCell className="font-mono text-xs text-right text-primary">{formatBRL(d.amount)}</TableCell>
                            <TableCell className="font-mono text-xs text-center">{MONTH_NAMES[d.month - 1]?.toUpperCase()}/{d.year}</TableCell>
                            <TableCell className="font-mono text-xs text-center text-muted-foreground">{d.payment_date}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleEditOpen(d)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeDividend(d.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Investment Calculator */}
        <InvestmentCalculator
          defaultInitial={calculatedAssets.reduce((s, a) => s + a.totalCurrent, 0)}
          defaultRate={(() => {
            const totalCurrent = calculatedAssets.reduce((s, a) => s + a.totalCurrent, 0);
            const totalMonthlyDY = assets.reduce((s, a) => s + (a.dividendYield * a.quantity), 0);
            return totalCurrent > 0 ? (totalMonthlyDY / totalCurrent) * 100 * 12 : 0;
          })()}
        />
      </main>
    </div>
  );
};

export default Dividends;
