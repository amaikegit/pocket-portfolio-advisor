-- Add price_cross schedule support to telegram_schedules
ALTER TABLE public.telegram_schedules
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- For price_cross we don't strictly need daily_times/weekdays, but keep schema flexible.
-- Allow chat_id to be checked separately; nothing else changes.
COMMENT ON COLUMN public.telegram_schedules.config IS 'Type-specific config. For price_cross: { ticker, threshold_price, direction: "above"|"below" }';
COMMENT ON COLUMN public.telegram_schedules.state IS 'Runtime state. For price_cross: { last_price, last_side: "above"|"below" }';