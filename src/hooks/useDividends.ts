import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Dividend {
  id: string;
  ticker: string;
  amount: number;
  payment_date: string;
  month: number;
  year: number;
}

export interface DividendInput {
  ticker: string;
  amount: number;
  payment_date: string;
  month: number;
  year: number;
}

export function useDividends() {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const { toast } = useToast();

  const fetchDividends = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from("dividends")
      .select("*")
      .eq("user_id", session.user.id)
      .order("year", { ascending: true })
      .order("month", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar dividendos", description: error.message, variant: "destructive" });
      return;
    }
    setDividends(
      (data || []).map((d: any) => ({
        id: d.id,
        ticker: d.ticker,
        amount: Number(d.amount),
        payment_date: d.payment_date,
        month: d.month,
        year: d.year,
      }))
    );
  }, [session?.user?.id, toast]);

  useEffect(() => {
    setLoading(true);
    fetchDividends().finally(() => setLoading(false));
  }, [fetchDividends]);

  const addDividend = useCallback(
    async (input: DividendInput) => {
      if (!session?.user?.id) return;
      const { error } = await supabase.from("dividends").insert({
        user_id: session.user.id,
        ticker: input.ticker.toUpperCase(),
        amount: input.amount,
        payment_date: input.payment_date,
        month: input.month,
        year: input.year,
      });
      if (error) {
        toast({ title: "Erro ao salvar dividendo", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Dividendo registrado!" });
      await fetchDividends();
    },
    [session?.user?.id, toast, fetchDividends]
  );

  const bulkImportDividends = useCallback(
    async (inputs: DividendInput[]): Promise<number> => {
      if (!session?.user?.id || inputs.length === 0) return 0;
      const rows = inputs.map((input) => ({
        user_id: session.user.id,
        ticker: input.ticker.toUpperCase(),
        amount: input.amount,
        payment_date: input.payment_date,
        month: input.month,
        year: input.year,
      }));
      const { error } = await supabase.from("dividends").insert(rows);
      if (error) {
        toast({ title: "Erro ao importar dividendos", description: error.message, variant: "destructive" });
        return 0;
      }
      toast({ title: `${inputs.length} dividendo(s) importado(s)!` });
      await fetchDividends();
      return inputs.length;
    },
    [session?.user?.id, toast, fetchDividends]
  );

  const removeDividend = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("dividends").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        return;
      }
      setDividends((prev) => prev.filter((d) => d.id !== id));
    },
    [toast]
  );

  // Aggregations
  const years = [...new Set(dividends.map((d) => d.year))].sort();
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  const monthlyByYear = () => {
    const grid: Record<number, Record<number, number>> = {};
    for (const y of years) grid[y] = {};
    for (const d of dividends) {
      if (!grid[d.year]) grid[d.year] = {};
      grid[d.year][d.month] = (grid[d.year][d.month] || 0) + d.amount;
    }
    return grid;
  };

  const totalByYear = (year: number) =>
    dividends.filter((d) => d.year === year).reduce((s, d) => s + d.amount, 0);

  const totalAll = dividends.reduce((s, d) => s + d.amount, 0);

  const totalByMonth = (month: number) =>
    dividends.filter((d) => d.month === month).reduce((s, d) => s + d.amount, 0);

  const averageMonthly = () => {
    if (dividends.length === 0) return 0;
    const uniqueMonths = new Set(dividends.map((d) => `${d.year}-${d.month}`));
    return totalAll / uniqueMonths.size;
  };

  return {
    dividends,
    loading,
    addDividend,
    bulkImportDividends,
    removeDividend,
    years,
    months,
    monthlyByYear,
    totalByYear,
    totalAll,
    totalByMonth,
    averageMonthly,
  };
}
