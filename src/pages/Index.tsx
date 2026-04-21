import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortfolio } from "@/hooks/usePortfolio";
import { AddAssetDialog } from "@/components/AddAssetDialog";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { PortfolioTable } from "@/components/PortfolioTable";
import { SummaryCards } from "@/components/SummaryCards";
import { PortfolioCharts } from "@/components/PortfolioCharts";
import { PortfolioEvolution } from "@/components/PortfolioEvolution";
import { PortfolioSnapshots } from "@/components/PortfolioSnapshots";
import { AlertsPanel } from "@/components/AlertsPanel";
import { AIAnalysisPanel } from "@/components/AIAnalysisPanel";
import { AIReportsHistory } from "@/components/AIReportsHistory";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, Loader2, FileText, LogOut, Menu, Clock, DollarSign } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";

const Index = () => {
  const { calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, addTransaction, transactions, assets, fetchAllPrices, fetchProgress, totals, lastUpdated } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try { await fetchAllPrices(); } catch {}
    setRefreshing(false);
  };

  const progressPct = fetchProgress.total > 0 ? (fetchProgress.current / fetchProgress.total) * 100 : 0;

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

          {/* Desktop buttons */}
          <div className="hidden md:flex gap-2">
            <AIAnalysisPanel assets={calculatedAssets} />
            <Button variant="outline" className="gap-2" onClick={handleRefreshAll} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar Cotações
            </Button>
            <CSVImportDialog onImport={importCSV} />
            <AddTransactionDialog onAdd={addTransaction} existingTickers={assets.map(a => a.ticker)} />
            <AddAssetDialog onAdd={addAsset} />
            <Button variant="outline" className="gap-2" onClick={() => navigate("/lancamentos")}>
              <FileText className="h-4 w-4" />
              Lançamentos
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/dividendos")}>
              <DollarSign className="h-4 w-4" />
              Dividendos
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile buttons */}
          <div className="flex md:hidden items-center gap-1.5">
            <ThemeToggle />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefreshAll} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-4 space-y-3">
                <h2 className="font-mono-display font-bold text-sm mb-4">Menu</h2>
                <div className="flex flex-col gap-2">
                  <AIAnalysisPanel assets={calculatedAssets} />
                  <CSVImportDialog onImport={importCSV} />
                  <AddTransactionDialog onAdd={addTransaction} existingTickers={assets.map(a => a.ticker)} />
                  <AddAssetDialog onAdd={addAsset} />
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/lancamentos")}>
                    <FileText className="h-4 w-4" />
                    Lançamentos
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/dividendos")}>
                    <DollarSign className="h-4 w-4" />
                    Dividendos
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={signOut}>
                    <LogOut className="h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {/* Progress bar */}
        {fetchProgress.total > 0 && (
          <div className="container mx-auto px-3 sm:px-4 pb-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fetchProgress.status}</span>
              <span>{fetchProgress.current}/{fetchProgress.total}</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}
      </header>

      {/* Last updated + Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Última atualização: {lastUpdated.toLocaleDateString("pt-BR")} às {lastUpdated.toLocaleTimeString("pt-BR")}</span>
          </div>
        )}
        <SummaryCards totals={totals} />
        <AlertsPanel />
        <PortfolioSnapshots />
        <AIReportsHistory />
        <PortfolioEvolution assets={assets} />
        <PortfolioCharts assets={calculatedAssets} />
        <PortfolioTable assets={calculatedAssets} onRemove={removeAsset} onUpdate={updateAsset} />
      </main>
    </div>
  );
};

export default Index;
