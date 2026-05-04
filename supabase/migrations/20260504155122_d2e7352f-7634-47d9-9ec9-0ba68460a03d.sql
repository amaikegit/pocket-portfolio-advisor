
CREATE TABLE public.telegram_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id bigint NOT NULL UNIQUE,
  flow text NOT NULL,
  step text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram sessions"
ON public.telegram_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram sessions"
ON public.telegram_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram sessions"
ON public.telegram_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram sessions"
ON public.telegram_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_telegram_sessions_updated_at
BEFORE UPDATE ON public.telegram_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
