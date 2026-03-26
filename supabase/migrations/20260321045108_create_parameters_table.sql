-- Create parameters table (per-stock user-adjustable valuation parameters)
CREATE TABLE parameters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,

  -- Basic parameters (Phase 1 UI)
  discount_rate NUMERIC NOT NULL DEFAULT 0.08,    -- r: discount rate (8%)
  growth_rate NUMERIC NOT NULL DEFAULT 0.02,      -- g: perpetual growth rate (2%)
  tax_rate NUMERIC NOT NULL DEFAULT 0.30,         -- effective tax rate (30%)
  cap_multiplier NUMERIC NOT NULL DEFAULT 10,     -- operating income multiplier cap (10x)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One parameter set per user per stock
ALTER TABLE parameters ADD CONSTRAINT parameters_unique_user_stock
  UNIQUE (user_id, stock_id);

-- Row Level Security
ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own parameters" ON parameters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parameters" ON parameters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parameters" ON parameters
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own parameters" ON parameters
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_parameters_user_id ON parameters (user_id);
CREATE INDEX idx_parameters_stock_id ON parameters (stock_id);

-- Auto-update updated_at (reuse existing function from financial_data migration)
CREATE TRIGGER set_parameters_updated_at
  BEFORE UPDATE ON parameters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
