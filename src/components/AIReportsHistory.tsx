import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Loader2, Sparkles, Trash2, Eye, Calendar } from "lucide-react";
import { toast } from "sonner";

interface AIReport {
  id: string;
  title: string;
  content: string;
  report_type: string;
  portfolio_snapshot: any;
  created_at: string;
}

export function AIReportsHistory() {
  const [reports, setReports] = useState<AIReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<AIReport | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Erro ao carregar relatórios.");
    } else {
      setReports(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sessão expirada."); return; }

      const { data, error } = await supabase.functions.invoke("weekly-ai-report", {
        body: { user_id: user.id, report_type: "manual" },
      });
      if (error) throw error;
      if ((data as any)?.processed > 0) {
        toast.success("Relatório gerado!");
        await load();
      } else {
        toast.error("Não foi possível gerar (carteira vazia?).");
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar relatório.");
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ai_reports").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else {
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-mono-display">
          <FileText className="h-4 w-4 text-primary" />
          Relatórios Semanais (IA)
          {reports.length > 0 && (
            <Badge variant="secondary" className="ml-1">{reports.length}</Badge>
          )}
        </CardTitle>
        <Button size="sm" onClick={generateNow} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? "Gerando..." : "Gerar agora"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum relatório ainda. Gere o primeiro ou aguarde o relatório semanal automático (segundas, 11:00 UTC).
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="space-y-2 pr-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm truncate">{r.title}</span>
                      <Badge variant={r.report_type === "weekly" ? "default" : "outline"} className="text-[10px] h-4">
                        {r.report_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(r)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono-display">
              <Sparkles className="h-4 w-4 text-primary" />
              {selected?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-2">
            {selected && (
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <ReactMarkdown>{selected.content}</ReactMarkdown>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
