-- Table to store AI-generated reports history
CREATE TABLE public.ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'weekly',
  portfolio_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai reports"
ON public.ai_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai reports"
ON public.ai_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai reports"
ON public.ai_reports FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_ai_reports_user_created ON public.ai_reports(user_id, created_at DESC);