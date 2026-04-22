import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Loader2, Sparkles, Trash2, Eye, Calendar, Download } from "lucide-react";
import { toast } from "sonner";
import { fetchPageByCreatedAtDesc } from "@/lib/supabasePagination";

const PAGE_SIZE = 25;

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
  const [exporting, setExporting] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { rows, nextCursor } = await fetchPageByCreatedAtDesc<AIReport>(
        "ai_reports", "*", undefined, null, PAGE_SIZE,
      );
      setReports(rows);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch {
      toast.error("Erro ao carregar relatórios.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { rows, nextCursor } = await fetchPageByCreatedAtDesc<AIReport>(
        "ai_reports", "*", undefined, cursor, PAGE_SIZE,
      );
      setReports((prev) => [...prev, ...rows]);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch {
      toast.error("Erro ao carregar mais relatórios.");
    } finally {
      setLoadingMore(false);
    }
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

  const exportPDF = async () => {
    if (!selected) return;
    const node = document.getElementById("ai-report-printable");
    if (!node) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20; // 10mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }
      const safeTitle = selected.title.replace(/[^a-z0-9\-_ ]/gi, "").trim() || "relatorio";
      pdf.save(`${safeTitle}.pdf`);
      toast.success("PDF exportado!");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao exportar PDF.");
    } finally {
      setExporting(false);
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
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 font-mono-display text-left">
                <Sparkles className="h-4 w-4 text-primary" />
                {selected?.title}
              </DialogTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={exportPDF}
                disabled={exporting || !selected}
                className="gap-2 shrink-0"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {exporting ? "Exportando..." : "Exportar PDF"}
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-2">
            {selected && (
              <div
                id="ai-report-printable"
                className="bg-background text-foreground px-6 py-4 rounded-md"
              >
                <div className="mb-4 pb-3 border-b border-border">
                  <h1 className="text-xl font-mono-display font-semibold mb-1">{selected.title}</h1>
                  <p className="text-xs text-muted-foreground">
                    Gerado em {new Date(selected.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <article
                  className="
                    prose prose-sm dark:prose-invert max-w-none
                    prose-headings:font-mono-display prose-headings:font-semibold
                    prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2 prose-h2:border-b prose-h2:border-border prose-h2:pb-1
                    prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5
                    prose-p:leading-relaxed
                    prose-strong:text-foreground
                    prose-ul:my-2 prose-ol:my-2
                    prose-li:my-0.5
                    prose-table:text-xs prose-table:my-3
                    prose-th:bg-muted prose-th:px-2 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold
                    prose-td:px-2 prose-td:py-1.5 prose-td:border-t prose-td:border-border
                  "
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
                </article>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
