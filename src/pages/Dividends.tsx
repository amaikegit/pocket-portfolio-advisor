import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDividends, DividendInput } from "@/hooks/useDividends";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";
import { BarChart3, Plus, ArrowLeft, LogOut, DollarSign, TrendingUp, Calendar, Loader2 } from "lucide-react";

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Dividends = () => {
  const {
    dividends, loading, addDividend, removeDividend,
    years, months, monthlyByYear, totalByYear, totalAll, totalByMonth, averageMonthly,
  } = useDividends();
  const { assets } = usePortfolio();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ticker: "", amount: "", month: "", year: "", date: "" });

  const handleAdd = async () => {
    if (!form.ticker || !form.amount || !form.month || !form.year) return;
    const input: DividendInput = {
      ticker: form.ticker,
      amount: parseFloat(form.amount.replace(",", ".")),
      payment_date: form.date || new Date().toISOString().slice(0, 10),
      month: parseInt(form.month),
      year: parseInt(form.year),
    };
    await addDividend(input);
    setForm({ ticker: "", amount: "", month: "", year: "", date: "" });
    setOpen(false);
  };

  const grid = monthlyByYear();
  const currentYear = new Date().getFullYear();
  const displayYears = years.length > 0 ? years : [currentYear];

  // Chart data: monthly totals for each year as bar chart
  const barData = MONTH_NAMES.map((m, i) => {
    const row: any = { month: m };
    for (const y of displayYears) {
      row[y] = grid[y]?.[i + 1] || 0;
    }
    return row;
  });

  // Yearly totals for line chart
  const lineData = displayYears.map((y) => ({ year: y.toString(), total: totalByYear(y) }));

  const chartConfig: Record<string, { label: string; color: string }> = {};
  const colors = ["hsl(142, 60%, 45%)", "hsl(38, 90%, 55%)", "hsl(200, 70%, 50%)", "hsl(280, 60%, 55%)", "hsl(0, 70%, 50%)"];
  displayYears.forEach((y, i) => {
    chartConfig[y] = { label: y.toString(), color: colors[i % colors.length] };
  });

  const existingTickers = assets.map((a) => a.ticker);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <Dialog open={open} onOpenChange={setOpen}>
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
                  <Button className="w-full" onClick={handleAdd}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
        </div>

        {/* Charts */}
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

        {/* Monthly Table (like the reference image) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase">Dividendos Pagos</CardTitle>
          </CardHeader>
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
                  {/* Totals row */}
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
        </Card>
      </main>
    </div>
  );
};

export default Dividends;
