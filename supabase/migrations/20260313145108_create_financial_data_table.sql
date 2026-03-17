-- Create financial_data table (wide-table design: 1 period = 1 row)
CREATE TABLE financial_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,

  -- Period attributes
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter TEXT NOT NULL CHECK (fiscal_quarter IN ('Q1', 'Q2', 'Q3', 'Q4', 'FY')),
  consolidation_type TEXT NOT NULL DEFAULT 'consolidated' CHECK (consolidation_type IN ('consolidated', 'standalone')),

  -- Required fields (stored in yen)
  revenue BIGINT NOT NULL,
  operating_income BIGINT NOT NULL,
  net_income BIGINT NOT NULL,
  total_assets BIGINT NOT NULL,
  equity BIGINT NOT NULL,

  -- Optional fields (stored in yen)
  interest_bearing_debt BIGINT,
  operating_cf BIGINT,
  investing_cf BIGINT,
  shares_outstanding BIGINT,
  interest_expense BIGINT,
  current_stock_price BIGINT,

  -- Metadata
  input_unit TEXT NOT NULL DEFAULT 'million' CHECK (input_unit IN ('yen', 'thousand', 'million', 'hundred_million')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: prevent duplicate periods for the same stock/user
ALTER TABLE financial_data ADD CONSTRAINT financial_data_unique_period
  UNIQUE (user_id, stock_id, fiscal_year, fiscal_quarter, consolidation_type);

-- Row Level Security
ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own financial_data" ON financial_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own financial_data" ON financial_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own financial_data" ON financial_data
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own financial_data" ON financial_data
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_financial_data_user_id ON financial_data (user_id);
CREATE INDEX idx_financial_data_stock_id ON financial_data (stock_id);
CREATE INDEX idx_financial_data_period ON financial_data (stock_id, fiscal_year DESC, fiscal_quarter);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_financial_data_updated_at
  BEFORE UPDATE ON financial_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Also add the trigger for stocks table (was missing)
CREATE TRIGGER set_stocks_updated_at
  BEFORE UPDATE ON stocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
