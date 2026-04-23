import { usePortfolio } from "@/hooks/usePortfolio";
import { TransactionHistory } from "@/components/TransactionHistory";
import { AppLayout } from "@/components/AppLayout";

const Transactions = () => {
  const { transactions, removeTransaction, addTransaction, assets } = usePortfolio();

  return (
    <AppLayout
      title={<>Histórico de <span className="text-primary">Lançamentos</span></>}
      assets={assets}
      addTransaction={addTransaction}
    >
      <TransactionHistory transactions={transactions} onRemove={removeTransaction} />
      {transactions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Nenhum lançamento registrado ainda.</p>
          <p className="text-xs mt-1">Use o menu lateral para adicionar sua primeira movimentação.</p>
        </div>
      )}
    </AppLayout>
  );
};

export default Transactions;
