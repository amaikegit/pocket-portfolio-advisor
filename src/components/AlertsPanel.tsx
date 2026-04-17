import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Bell, AlertTriangle, CheckCircle2, Info, X, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "success";
  ticker: string | null;
  read: boolean;
  created_at: string;
}

const severityConfig = {
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10 border-primary/30" },
};

export function AlertsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRead, setShowRead] = useState(false);

  const load = async () => {
    if (!user) return;
    let query = supabase.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (!showRead) query = query.eq("read", false);
    const { data, error } = await query;
    if (error) toast({ title: "Erro ao carregar alertas", description: error.message, variant: "destructive" });
    else setAlerts((data ?? []) as Alert[]);
  };

  useEffect(() => { load(); }, [user, showRead]);

  const compute = async () => {
    setLoading(true);
    const { error } = await supabase.functions.invoke("compute-alerts");
    if (error) toast({ title: "Erro ao gerar alertas", description: error.message, variant: "destructive" });
    else { toast({ title: "Alertas atualizados!" }); await load(); }
    setLoading(false);
  };

  const dismiss = async (id: string) => {
    await supabase.from("alerts").update({ read: true }).eq("id", id);
    setAlerts((p) => p.filter((a) => a.id !== id));
  };

  const dismissAll = async () => {
    if (!user) return;
    await supabase.from("alerts").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setAlerts([]);
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Alertas Inteligentes</CardTitle>
          {unreadCount > 0 && <Badge variant="default">{unreadCount}</Badge>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setShowRead((s) => !s)}>
            {showRead ? "Só não lidos" : "Mostrar lidos"}
          </Button>
          {alerts.length > 0 && !showRead && (
            <Button variant="ghost" size="sm" onClick={dismissAll}>Marcar todos</Button>
          )}
          <Button variant="outline" size="sm" onClick={compute} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Recalcular</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nenhum alerta {showRead ? "" : "novo"}. Clique em "Recalcular" para verificar.
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => {
              const cfg = severityConfig[a.severity] ?? severityConfig.info;
              const Icon = cfg.icon;
              return (
                <div key={a.id} className={cn("flex items-start gap-3 p-3 rounded-lg border", cfg.bg)}>
                  <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{a.title}</p>
                      {a.ticker && <Badge variant="outline" className="text-xs">{a.ticker}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {!a.read && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => dismiss(a.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
