CREATE TABLE public.rating_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  weights jsonb NOT NULL,
  thresholds jsonb NOT NULL,
  enabled_criteria text[] NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rating_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rating presets" ON public.rating_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rating presets" ON public.rating_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rating presets" ON public.rating_presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rating presets" ON public.rating_presets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_rating_presets_updated_at
BEFORE UPDATE ON public.rating_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_rating_presets_user ON public.rating_presets(user_id);