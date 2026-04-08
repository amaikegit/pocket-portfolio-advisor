
-- Create assets table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC NOT NULL DEFAULT 0,
  is_manual_price BOOLEAN NOT NULL DEFAULT true,
  average_price NUMERIC NOT NULL DEFAULT 0,
  total_invested NUMERIC NOT NULL DEFAULT 0,
  dividend_yield NUMERIC NOT NULL DEFAULT 0,
  pvp NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('acoes', 'fiis', 'bdrs', 'etfs', 'cripto')),
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  other_costs NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Assets policies
CREATE POLICY "Users can view own assets" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
