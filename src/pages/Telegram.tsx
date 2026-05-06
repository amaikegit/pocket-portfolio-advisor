import { usePortfolio } from "@/hooks/usePortfolio";
import { useState } from "react";
import { TelegramSettings } from "@/components/TelegramSettings";
import { TelegramSchedules } from "@/components/TelegramSchedules";
import { AppLayout } from "@/components/AppLayout";

const TelegramPage = () => {
  const {
    calculatedAssets, addAsset, addTransaction, importCSV,
    assets, fetchAllPrices, fetchProgress, lastUpdated,
  } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try { await fetchAllPrices(); } catch {}
    setRefreshing(false);
  };

  return (
    <AppLayout
      title={<>Telegram<span className="text-primary">Bot</span></>}
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
      <TelegramSettings />
      <TelegramSchedules />
    </AppLayout>
  );
};

export default TelegramPage;