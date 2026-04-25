ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS fii_type text,
  ADD COLUMN IF NOT EXISTS fii_segment text;