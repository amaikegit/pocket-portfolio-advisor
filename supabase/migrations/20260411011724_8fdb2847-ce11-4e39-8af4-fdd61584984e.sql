
CREATE TABLE public.dividends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dividends" ON public.dividends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dividends" ON public.dividends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dividends" ON public.dividends FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dividends" ON public.dividends FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_dividends_user_year ON public.dividends (user_id, year);
