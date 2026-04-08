import { usePortfolio } from "@/hooks/usePortfolio";
import { TransactionHistory } from "@/components/TransactionHistory";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Transactions = () => {
  const { transactions, removeTransaction, addTransaction, assets } = usePortfolio();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-mono-display text-lg font-bold tracking-tight">
              Histórico de <span className="text-primary">Lançamentos</span>
            </h1>
          </div>
          <AddTransactionDialog onAdd={addTransaction} existingTickers={assets.map(a => a.ticker)} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <TransactionHistory transactions={transactions} onRemove={removeTransaction} />
        {transactions.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">Nenhum lançamento registrado ainda.</p>
            <p className="text-xs mt-1">Use o botão acima para adicionar sua primeira movimentação.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Transactions;
