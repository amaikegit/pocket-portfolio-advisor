CREATE TABLE IF NOT EXISTS public.fii_vacancy_cache (
  ticker TEXT PRIMARY KEY,
  vacancia_fisica NUMERIC,
  vacancia_financeira NUMERIC,
  periodo INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fii_vacancy_cache TO authenticated;
GRANT ALL ON public.fii_vacancy_cache TO service_role;

ALTER TABLE public.fii_vacancy_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vacancy cache readable by authenticated"
  ON public.fii_vacancy_cache FOR SELECT
  TO authenticated USING (true);

CREATE TRIGGER trg_fii_vacancy_cache_updated_at
  BEFORE UPDATE ON public.fii_vacancy_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();