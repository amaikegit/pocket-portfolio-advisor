-- Tabela de chats do Telegram (grupos ou privados extras) por usuário
CREATE TABLE public.telegram_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_id BIGINT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Grupo Telegram',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);

ALTER TABLE public.telegram_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram chats" ON public.telegram_chats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own telegram chats" ON public.telegram_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own telegram chats" ON public.telegram_chats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own telegram chats" ON public.telegram_chats
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_telegram_chats_updated_at
  BEFORE UPDATE ON public.telegram_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agendamentos
CREATE TABLE public.telegram_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  -- 'patrimony' | 'dividends_month' | 'top_movers'
  kind TEXT NOT NULL,
  -- 'interval' (a cada N horas) | 'daily' (horários fixos)
  mode TEXT NOT NULL DEFAULT 'daily',
  interval_hours INTEGER,
  -- horários no formato 'HH:MM' (BRT). Ex: ['09:00','18:00']
  daily_times TEXT[] NOT NULL DEFAULT '{}',
  -- 0=domingo, 1=segunda ... 6=sábado. Vazio = todos os dias.
  weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules" ON public.telegram_schedules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedules" ON public.telegram_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON public.telegram_schedules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON public.telegram_schedules
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_telegram_schedules_updated_at
  BEFORE UPDATE ON public.telegram_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_telegram_schedules_due
  ON public.telegram_schedules (enabled, next_run_at)
  WHERE enabled = true;