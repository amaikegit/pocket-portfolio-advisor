import { useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { PortfolioTable } from "@/components/PortfolioTable";
import { SummaryCards } from "@/components/SummaryCards";
import { PortfolioCharts } from "@/components/PortfolioCharts";
import { FIIBreakdownCharts } from "@/components/FIIBreakdownCharts";
import { PortfolioEvolution } from "@/components/PortfolioEvolution";
import { PortfolioSnapshots } from "@/components/PortfolioSnapshots";
import { AlertsPanel } from "@/components/AlertsPanel";
import { AIReportsHistory } from "@/components/AIReportsHistory";
import { AppLayout } from "@/components/AppLayout";

const Index = () => {
  const {
    calculatedAssets, addAsset, updateAsset, removeAsset, importCSV,
    addTransaction, assets, fetchAllPrices, fetchProgress, totals, lastUpdated,
  } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try { await fetchAllPrices(); } catch {}
    setRefreshing(false);
  };

  return (
    <AppLayout
      title={<>Portfolio<span className="text-primary">Tracker</span></>}
      fetchProgress={fetchProgress}
      lastUpdated={lastUpdated}
      refreshing={refreshing}
      onRefresh={handleRefreshAll}
      calculatedAssets={calculatedAssets}
      assets={assets}
      addAsset={addAsset}
      addTransaction={addTransaction}
      importCSV={importCSV}
    >
      <SummaryCards totals={totals} />
      <AlertsPanel />
      <PortfolioSnapshots />
      <AIReportsHistory />
      <PortfolioEvolution assets={assets} />
      <PortfolioCharts assets={calculatedAssets} />
      <FIIBreakdownCharts assets={calculatedAssets} />
      <PortfolioTable assets={calculatedAssets} onRemove={removeAsset} onUpdate={updateAsset} />
    </AppLayout>
  );
};

export default Index;
