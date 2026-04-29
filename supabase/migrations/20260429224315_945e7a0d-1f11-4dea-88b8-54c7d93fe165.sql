CREATE TABLE public.table_filter_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'portfolio_table',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.table_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own table filter presets"
ON public.table_filter_presets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own table filter presets"
ON public.table_filter_presets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own table filter presets"
ON public.table_filter_presets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own table filter presets"
ON public.table_filter_presets FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_table_filter_presets_updated_at
BEFORE UPDATE ON public.table_filter_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_table_filter_presets_user_scope ON public.table_filter_presets(user_id, scope);