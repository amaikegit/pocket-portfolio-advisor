import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, Camera } from "lucide-react";

interface Snapshot {
  snapshot_date: string;
  total_current: number;
  total_invested: number;
  total_difference: number;
}

const PERIODS = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "6M", days: 180 },
  { label: "1A", days: 365 },
  { label: "Tudo", days: 9999 },
];

export function PortfolioSnapshots() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(90);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - period);
    const { data: rows, error } = await supabase
      .from("portfolio_snapshots")
      .select("snapshot_date, total_current, total_invested, total_difference")
      .eq("user_id", user.id)
      .gte("snapshot_date", since.toISOString().slice(0, 10))
      .order("snapshot_date", { ascending: true });
    if (error) toast({ title: "Erro ao carregar histórico", description: error.message, variant: "destructive" });
    else setData((rows ?? []) as Snapshot[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, period]);

  const triggerSnapshot = async () => {
    setLoading(true);
    const { error } = await supabase.functions.invoke("snapshot-portfolios");
    if (error) toast({ title: "Erro ao criar snapshot", description: error.message, variant: "destructive" });
    else { toast({ title: "Snapshot registrado!" }); await load(); }
    setLoading(false);
  };

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>Histórico Real do Patrimônio</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Snapshots diários automáticos da sua carteira</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <Button key={p.label} variant={period === p.days ? "default" : "outline"} size="sm" onClick={() => setPeriod(p.days)}>
              {p.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={triggerSnapshot} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span className="ml-2">Snapshot agora</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? "Carregando..." : "Nenhum snapshot ainda. O primeiro será gerado automaticamente hoje à noite, ou clique em \"Snapshot agora\"."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="snapshot_date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: number) => fmt(v)}
              />
              <Legend />
              <Line type="monotone" dataKey="total_current" name="Patrimônio Atual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total_invested" name="Total Investido" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
