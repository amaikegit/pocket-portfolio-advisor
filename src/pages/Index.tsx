import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortfolio } from "@/hooks/usePortfolio";
import { AddAssetDialog } from "@/components/AddAssetDialog";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { PortfolioTable } from "@/components/PortfolioTable";
import { SummaryCards } from "@/components/SummaryCards";
import { PortfolioCharts } from "@/components/PortfolioCharts";
import { AIAnalysisPanel } from "@/components/AIAnalysisPanel";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, Loader2, FileText, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, addTransaction, transactions, assets, fetchAllPrices, fetchProgress, totals } = usePortfolio();
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <h1 className="font-mono-display text-lg font-bold tracking-tight">
              Portfolio<span className="text-primary">Tracker</span>
            </h1>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
        {/* Progress bar */}
        {fetchProgress.total > 0 && (
          <div className="container mx-auto px-4 pb-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fetchProgress.status}</span>
              <span>{fetchProgress.current}/{fetchProgress.total}</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        <SummaryCards totals={totals} />
        <PortfolioCharts assets={calculatedAssets} />
        <PortfolioTable assets={calculatedAssets} onRemove={removeAsset} onUpdate={updateAsset} />
      </main>
    </div>
  );
};

export default Index;
