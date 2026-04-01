import { usePortfolio } from "@/hooks/usePortfolio";
import { AddAssetDialog } from "@/components/AddAssetDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { PortfolioTable } from "@/components/PortfolioTable";
import { SummaryCards } from "@/components/SummaryCards";
import { BarChart3 } from "lucide-react";

const Index = () => {
  const { calculatedAssets, addAsset, updateAsset, removeAsset, importCSV, fetchPrice, totals } = usePortfolio();

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
            <CSVImportDialog onImport={importCSV} />
            <AddAssetDialog onAdd={addAsset} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        <SummaryCards totals={totals} />
        <PortfolioTable assets={calculatedAssets} onRemove={removeAsset} onUpdate={updateAsset} onFetchPrice={fetchPrice} />
      </main>
    </div>
  );
};

export default Index;
