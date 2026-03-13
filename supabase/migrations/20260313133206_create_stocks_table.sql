-- Create stocks table
CREATE TABLE stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  market TEXT,
  sector TEXT,
  business_segment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: same user cannot register the same stock code twice
ALTER TABLE stocks ADD CONSTRAINT stocks_user_stock_code_unique UNIQUE (user_id, stock_code);

-- Row Level Security
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own stocks" ON stocks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stocks" ON stocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stocks" ON stocks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stocks" ON stocks
  FOR DELETE USING (auth.uid() = user_id);

-- Index for user_id lookups
CREATE INDEX idx_stocks_user_id ON stocks (user_id);
