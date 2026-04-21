CREATE TABLE public.report_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_id UUID,
  report_type TEXT NOT NULL DEFAULT 'weekly',
  total_current NUMERIC NOT NULL DEFAULT 0,
  total_invested NUMERIC NOT NULL DEFAULT 0,
  rentabilidade_pct NUMERIC NOT NULL DEFAULT 0,
  dividends_week_total NUMERIC NOT NULL DEFAULT 0,
  dividends_week_count INTEGER NOT NULL DEFAULT 0,
  previous_snapshot_id UUID,
  delta_current NUMERIC,
  delta_rentabilidade_pct NUMERIC,
  delta_dividends_week NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own report snapshots"
  ON public.report_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own report snapshots"
  ON public.report_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own report snapshots"
  ON public.report_snapshots FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_report_snapshots_user_created
  ON public.report_snapshots (user_id, created_at DESC);