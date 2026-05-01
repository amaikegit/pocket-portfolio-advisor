import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Copy, Unlink, Check } from "lucide-react";

interface TelegramLink {
  id: string;
  chat_id: number;
  username: string | null;
  first_name: string | null;
  alerts_enabled: boolean;
  reports_enabled: boolean;
}

export function TelegramSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("telegram_links")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setLink(data as TelegramLink | null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Poll every 5s while waiting for link
  useEffect(() => {
    if (!code || link) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [code, link]);

  const generate = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("telegram-link-code");
    if (error || !data?.code) {
      toast({ title: "Erro ao gerar código", description: error?.message, variant: "destructive" });
    } else {
      setCode(data.code);
      setBotUsername(data.bot_username ?? null);
      setExpiresAt(data.expires_at ?? null);
    }
    setGenerating(false);
  };

  const copyCommand = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(`/start ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePref = async (field: "alerts_enabled" | "reports_enabled", value: boolean) => {
    if (!link) return;
    const update = field === "alerts_enabled"
      ? { alerts_enabled: value }
      : { reports_enabled: value };
    const { error } = await supabase
      .from("telegram_links")
      .update(update)
      .eq("id", link.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setLink({ ...link, [field]: value });
    }
  };

  const unlink = async () => {
    if (!link) return;
    if (!confirm("Desvincular o Telegram? Você não receberá mais alertas e relatórios por lá.")) return;
    const { error } = await supabase.from("telegram_links").delete().eq("id", link.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setLink(null);
      setCode(null);
      toast({ title: "Telegram desvinculado" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <CardTitle>Telegram</CardTitle>
          {link && <Badge variant="default">Conectado</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : link ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Conta vinculada a <span className="font-medium text-foreground">
                {link.username ? `@${link.username}` : link.first_name ?? `chat ${link.chat_id}`}
              </span>. Envie <code className="px-1.5 py-0.5 rounded bg-muted">/ajuda</code> no chat para ver os comandos disponíveis.
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="alerts-tg" className="cursor-pointer">
                  <div className="font-medium text-sm">Receber alertas inteligentes</div>
                  <div className="text-xs text-muted-foreground">Dividendo silencioso, meta mensal, etc.</div>
                </Label>
                <Switch
                  id="alerts-tg"
                  checked={link.alerts_enabled}
                  onCheckedChange={(v) => togglePref("alerts_enabled", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="reports-tg" className="cursor-pointer">
                  <div className="font-medium text-sm">Receber relatórios da IA</div>
                  <div className="text-xs text-muted-foreground">Resumo + análise quando o relatório for gerado.</div>
                </Label>
                <Switch
                  id="reports-tg"
                  checked={link.reports_enabled}
                  onCheckedChange={(v) => togglePref("reports_enabled", v)}
                />
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={unlink}>
              <Unlink className="h-4 w-4 mr-2" />
              Desvincular
            </Button>
          </div>
        ) : code ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Abra o bot {botUsername ? <a className="text-primary font-medium underline" href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer">@{botUsername}</a> : "do Telegram configurado"} no Telegram.</li>
                <li>Envie o comando abaixo no chat:</li>
              </ol>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-muted font-mono text-sm">/start {code}</code>
              <Button variant="outline" size="icon" onClick={copyCommand}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Código válido por 10 minutos. Aguardando vinculação...
              <Loader2 className="inline-block h-3 w-3 animate-spin ml-1" />
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte seu Telegram para receber alertas, relatórios e consultar sua carteira a qualquer momento via comandos como <code className="px-1.5 py-0.5 rounded bg-muted">/patrimonio</code> e <code className="px-1.5 py-0.5 rounded bg-muted">/dividendos</code>.
            </p>
            <Button onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Conectar Telegram
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}