-- Reuse a generic timestamp trigger if not present
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.rating_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  weights JSONB NOT NULL DEFAULT '{
    "valuation": 25,
    "dividendYield": 25,
    "priceVsAverage": 15,
    "unrealizedPnL": 15,
    "concentration": 10,
    "dividendConsistency": 10
  }'::jsonb,
  thresholds JSONB NOT NULL DEFAULT '{
    "valuation": {"excellent": 0.85, "good": 1.0, "fair": 1.1},
    "dividendYield": {"excellent": 1.0, "good": 0.7, "fair": 0.4},
    "priceVsAverage": {"excellent": -5, "good": 0, "fair": 10},
    "concentration": {"idealMin": 5, "idealMax": 15, "highMax": 25, "lowMin": 2},
    "dividendConsistency": {"excellent": 10, "good": 6, "fair": 1}
  }'::jsonb,
  enabled_criteria TEXT[] NOT NULL DEFAULT ARRAY[
    'valuation','dividendYield','priceVsAverage','unrealizedPnL','concentration','dividendConsistency'
  ],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rating_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rating settings"
ON public.rating_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rating settings"
ON public.rating_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rating settings"
ON public.rating_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rating settings"
ON public.rating_settings FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_rating_settings_updated_at
BEFORE UPDATE ON public.rating_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();