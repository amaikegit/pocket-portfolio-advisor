import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Plus, Trash2, Send, Pencil, Bell } from "lucide-react";
import { formatBRDateTime } from "@/lib/brt";

type Kind = "patrimony" | "dividends_month" | "top_movers" | "price_cross";
type Mode = "interval" | "daily";

interface ChatRow {
  id: string;
  chat_id: number;
  label: string;
}
interface Schedule {
  id: string;
  chat_id: number;
  name: string;
  kind: Kind;
  mode: Mode;
  interval_hours: number | null;
  daily_times: string[];
  weekdays: number[];
  enabled: boolean;
  last_sent_at: string | null;
  next_run_at: string | null;
  config: any;
  state: any;
}

const KIND_LABEL: Record<Kind, string> = {
  patrimony: "Patrimônio + variação do dia",
  dividends_month: "Dividendos do mês",
  top_movers: "Top movimentações do dia",
  price_cross: "Cruzamento de preço",
};
const KIND_ICON: Record<Kind, string> = {
  patrimony: "💰",
  dividends_month: "💵",
  top_movers: "📊",
  price_cross: "🎯",
};

const WEEKDAYS = [
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
  { v: 0, label: "Dom" },
];

const SUGGESTIONS: Array<{ name: string; kind: Kind; mode: Mode; interval_hours?: number; daily_times?: string[]; weekdays: number[]; description: string }> = [
  { name: "Patrimônio diário (manhã e noite)", kind: "patrimony", mode: "daily", daily_times: ["09:00", "18:30"], weekdays: [1,2,3,4,5], description: "Saldo total + variação do dia em dias úteis às 9h e 18h30." },
  { name: "Patrimônio a cada 4h", kind: "patrimony", mode: "interval", interval_hours: 4, weekdays: [1,2,3,4,5], description: "Atualização do patrimônio a cada 4 horas em dias úteis." },
  { name: "Resumo semanal de dividendos", kind: "dividends_month", mode: "daily", daily_times: ["20:00"], weekdays: [5], description: "Toda sexta às 20h, total de dividendos do mês + meta." },
  { name: "Top movimentações no fechamento", kind: "top_movers", mode: "daily", daily_times: ["18:30"], weekdays: [1,2,3,4,5], description: "3 ativos que mais subiram e mais caíram, após o fechamento do pregão." },
  { name: "Alerta de preço (cruzamento)", kind: "price_cross", mode: "interval", interval_hours: 1, weekdays: [0,1,2,3,4,5,6], description: "Avisa quando o preço atual de um ticker cruza um valor (acima/abaixo)." },
];

export function TelegramSchedules() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Add chat
  const [newChatId, setNewChatId] = useState("");
  const [newChatLabel, setNewChatLabel] = useState("");
  const [addingChat, setAddingChat] = useState(false);

  // Schedule dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState({
    name: "",
    chat_id: "" as string,
    kind: "patrimony" as Kind,
    mode: "daily" as Mode,
    interval_hours: 4,
    daily_times: ["09:00"] as string[],
    weekdays: [1,2,3,4,5] as number[],
    enabled: true,
    ticker: "",
    threshold_price: "" as string,
    direction: "above" as "above" | "below",
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("telegram_chats").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("telegram_schedules").select("*").eq("user_id", user.id).order("created_at"),
    ]);
    setChats((c ?? []) as ChatRow[]);
    setSchedules((s ?? []) as Schedule[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const addChat = async () => {
    if (!user) return;
    const idNum = Number(newChatId.trim());
    if (!Number.isFinite(idNum) || idNum === 0) {
      toast({ title: "Chat ID inválido", description: "Cole o chat_id do grupo (número, geralmente negativo).", variant: "destructive" });
      return;
    }
    setAddingChat(true);
    const { error } = await supabase.from("telegram_chats").insert({
      user_id: user.id,
      chat_id: idNum,
      label: newChatLabel.trim() || "Grupo Telegram",
    });
    setAddingChat(false);
    if (error) {
      toast({ title: "Erro ao adicionar chat", description: error.message, variant: "destructive" });
      return;
    }
    setNewChatId(""); setNewChatLabel("");
    toast({ title: "Chat adicionado" });
    load();
  };

  const removeChat = async (id: string) => {
    if (!confirm("Remover este chat? Os agendamentos vinculados continuam, mas precisam ser apontados para outro chat.")) return;
    const { error } = await supabase.from("telegram_chats").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const openNew = (preset?: typeof SUGGESTIONS[number]) => {
    if (chats.length === 0) {
      toast({ title: "Adicione um chat primeiro", description: "Cadastre o chat_id do grupo antes de criar um agendamento.", variant: "destructive" });
      return;
    }
    setEditing(null);
    setForm({
      name: preset?.name ?? "",
      chat_id: String(chats[0].chat_id),
      kind: preset?.kind ?? "patrimony",
      mode: preset?.mode ?? "daily",
      interval_hours: preset?.interval_hours ?? 4,
      daily_times: preset?.daily_times ?? ["09:00"],
      weekdays: preset?.weekdays ?? [1,2,3,4,5],
      enabled: true,
      ticker: "",
      threshold_price: "",
      direction: "above",
    });
    setOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({
      name: s.name,
      chat_id: String(s.chat_id),
      kind: s.kind,
      mode: s.mode,
      interval_hours: s.interval_hours ?? 4,
      daily_times: s.daily_times?.length ? s.daily_times : ["09:00"],
      weekdays: s.weekdays?.length ? s.weekdays : [1,2,3,4,5],
      enabled: s.enabled,
      ticker: String(s.config?.ticker ?? ""),
      threshold_price: s.config?.threshold_price != null ? String(s.config.threshold_price) : "",
      direction: (s.config?.direction === "below" ? "below" : "above"),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast({ title: "Dê um nome ao alerta", variant: "destructive" }); return;
    }
    if (!form.chat_id) {
      toast({ title: "Escolha um chat", variant: "destructive" }); return;
    }
    if (form.kind === "price_cross") {
      const tk = form.ticker.trim().toUpperCase();
      const thr = Number(String(form.threshold_price).replace(",", "."));
      if (!tk) { toast({ title: "Informe o ticker", variant: "destructive" }); return; }
      if (!Number.isFinite(thr) || thr <= 0) { toast({ title: "Informe um preço-alvo válido", variant: "destructive" }); return; }
    }
    const payload = {
      user_id: user.id,
      chat_id: Number(form.chat_id),
      name: form.name.trim(),
      kind: form.kind,
      mode: form.kind === "price_cross" ? "interval" : form.mode,
      interval_hours: form.kind === "price_cross"
        ? 1
        : (form.mode === "interval" ? Math.max(1, Number(form.interval_hours) || 1) : null),
      daily_times: form.kind !== "price_cross" && form.mode === "daily"
        ? form.daily_times.filter(t => /^\d{2}:\d{2}$/.test(t)) : [],
      weekdays: form.kind === "price_cross"
        ? [0,1,2,3,4,5,6]
        : (form.weekdays.length ? form.weekdays : [0,1,2,3,4,5,6]),
      enabled: form.enabled,
      next_run_at: null,
      config: form.kind === "price_cross"
        ? {
            ticker: form.ticker.trim().toUpperCase(),
            threshold_price: Number(String(form.threshold_price).replace(",", ".")),
            direction: form.direction,
          }
        : {},
      state: {},
    };
    const { error } = editing
      ? await supabase.from("telegram_schedules").update(payload).eq("id", editing.id)
      : await supabase.from("telegram_schedules").insert(payload);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    toast({ title: editing ? "Agendamento atualizado" : "Agendamento criado" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este agendamento?")) return;
    const { error } = await supabase.from("telegram_schedules").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const toggle = async (s: Schedule, value: boolean) => {
    const { error } = await supabase.from("telegram_schedules")
      .update({ enabled: value, next_run_at: value ? null : s.next_run_at })
      .eq("id", s.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const testNow = async (s: Schedule) => {
    const { error } = await supabase.functions.invoke("telegram-scheduler", {
      body: { schedule_id: s.id, test: true },
    });
    if (error) toast({ title: "Erro ao testar", description: error.message, variant: "destructive" });
    else toast({ title: "Mensagem enfileirada", description: "Deve chegar no chat em alguns segundos." });
  };

  const toggleWeekday = (v: number) => {
    setForm(f => ({
      ...f,
      weekdays: f.weekdays.includes(v) ? f.weekdays.filter(x => x !== v) : [...f.weekdays, v].sort(),
    }));
  };

  const updateTime = (i: number, v: string) =>
    setForm(f => ({ ...f, daily_times: f.daily_times.map((t, idx) => idx === i ? v : t) }));
  const addTime = () => setForm(f => ({ ...f, daily_times: [...f.daily_times, "12:00"] }));
  const removeTime = (i: number) => setForm(f => ({ ...f, daily_times: f.daily_times.filter((_, idx) => idx !== i) }));

  const chatLabel = (chatId: number) => {
    const c = chats.find(x => Number(x.chat_id) === Number(chatId));
    return c ? c.label : `chat ${chatId}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <CardTitle>Alertas agendados no Telegram</CardTitle>
        </div>
        <Button size="sm" onClick={() => openNew()}>
          <Plus className="h-4 w-4 mr-1" /> Novo agendamento
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chats cadastrados */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Chats / grupos</div>
          <p className="text-xs text-muted-foreground">
            Adicione o bot ao grupo do Telegram, descubra o <code className="px-1 rounded bg-muted">chat_id</code> (geralmente um número negativo, ex.: <code>-1001234567890</code>) e cole abaixo.
            Você pode descobrir enviando uma mensagem no grupo e usando bots como <code>@RawDataBot</code>, ou pelo log da função <code>telegram-poll</code>.
          </p>
          <div className="space-y-2">
            {chats.map(c => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{c.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.chat_id}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeChat(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              placeholder="Nome do grupo (opcional)"
              value={newChatLabel}
              onChange={e => setNewChatLabel(e.target.value)}
            />
            <Input
              placeholder="chat_id (ex.: -1001234567890)"
              value={newChatId}
              onChange={e => setNewChatId(e.target.value)}
              inputMode="numeric"
            />
            <Button onClick={addChat} disabled={addingChat}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Sugestões prontas */}
        {schedules.length === 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-1.5"><Bell className="h-4 w-4" /> Sugestões</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.name}
                  onClick={() => openNew(s)}
                  className="text-left rounded-lg border p-3 hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm">{KIND_ICON[s.kind]} {s.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lista de agendamentos */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Agendamentos ativos</div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : schedules.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum agendamento. Clique em "Novo agendamento" ou use uma sugestão acima.</div>
          ) : (
            schedules.map(s => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{KIND_ICON[s.kind]} {s.name}</span>
                    <Badge variant="secondary" className="text-xs">{KIND_LABEL[s.kind]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.kind === "price_cross" ? (
                      <>
                        {s.config?.ticker} {s.config?.direction === "below" ? "abaixo de" : "acima de"} <b>R$ {Number(s.config?.threshold_price ?? 0).toFixed(2)}</b>
                        {" · "}verifica a cada minuto
                        {" · "}para <span className="font-medium">{chatLabel(s.chat_id)}</span>
                      </>
                    ) : (
                      <>
                        {s.mode === "interval"
                          ? `A cada ${s.interval_hours}h`
                          : `Horários: ${(s.daily_times ?? []).join(", ") || "—"}`}
                        {" · "}
                        {s.weekdays?.length === 7 ? "todos os dias" : s.weekdays.map(w => WEEKDAYS.find(x => x.v === w)?.label).join("/")}
                        {" · "}
                        para <span className="font-medium">{chatLabel(s.chat_id)}</span>
                      </>
                    )}
                  </div>
                  {s.next_run_at && s.enabled && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Próximo envio: {formatBRDateTime(s.next_run_at)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={s.enabled} onCheckedChange={(v) => toggle(s, v)} />
                  <Button size="icon" variant="ghost" onClick={() => testNow(s)} title="Testar agora">
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Dialog de criar/editar */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex.: Patrimônio diário" />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de alerta</Label>
                <Select value={form.kind} onValueChange={(v: Kind) => setForm(f => ({ ...f, kind: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patrimony">💰 Patrimônio + variação do dia</SelectItem>
                    <SelectItem value="dividends_month">💵 Dividendos do mês</SelectItem>
                    <SelectItem value="top_movers">📊 Top movimentações</SelectItem>
                    <SelectItem value="price_cross">🎯 Cruzamento de preço (ticker)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Enviar para</Label>
                <Select value={form.chat_id} onValueChange={(v) => setForm(f => ({ ...f, chat_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Escolha o chat" /></SelectTrigger>
                  <SelectContent>
                    {chats.map(c => (
                      <SelectItem key={c.id} value={String(c.chat_id)}>{c.label} ({c.chat_id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.kind === "price_cross" ? (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">
                    Verifica o preço atual do ticker a cada minuto e dispara <b>uma única vez</b> quando o preço cruza o alvo.
                    Se voltar e cruzar de novo, dispara novamente.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Ticker</Label>
                      <Input
                        placeholder="Ex.: PETR4"
                        value={form.ticker}
                        onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Direção</Label>
                      <Select value={form.direction} onValueChange={(v: "above"|"below") => setForm(f => ({ ...f, direction: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="above">⬆️ Acima de</SelectItem>
                          <SelectItem value="below">⬇️ Abaixo de</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço-alvo (R$)</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      placeholder="Ex.: 32.50"
                      value={form.threshold_price}
                      onChange={e => setForm(f => ({ ...f, threshold_price: e.target.value }))}
                    />
                  </div>
                </div>
              ) : (
              <>
              <div className="space-y-1.5">
                <Label>Recorrência</Label>
                <Select value={form.mode} onValueChange={(v: Mode) => setForm(f => ({ ...f, mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Horários fixos no dia</SelectItem>
                    <SelectItem value="interval">A cada N horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.mode === "interval" ? (
                <div className="space-y-1.5">
                  <Label>Intervalo (horas)</Label>
                  <Input
                    type="number" min={1} max={48}
                    value={form.interval_hours}
                    onChange={e => setForm(f => ({ ...f, interval_hours: Number(e.target.value) }))}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Horários (BRT)</Label>
                  <div className="space-y-2">
                    {form.daily_times.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time" value={t}
                          onChange={e => updateTime(i, e.target.value)}
                          className="max-w-[140px]"
                        />
                        {form.daily_times.length > 1 && (
                          <Button size="icon" variant="ghost" onClick={() => removeTime(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" size="sm" variant="outline" onClick={addTime}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar horário
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Dias da semana</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(w => (
                    <label key={w.v} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-accent">
                      <Checkbox
                        checked={form.weekdays.includes(w.v)}
                        onCheckedChange={() => toggleWeekday(w.v)}
                      />
                      <span className="text-sm">{w.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              </>
              )}

              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="enabled-sched" className="cursor-pointer">Ativo</Label>
                <Switch id="enabled-sched" checked={form.enabled} onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}