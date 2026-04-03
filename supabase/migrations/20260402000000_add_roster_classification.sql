-- Add roster_category column to stocks table
ALTER TABLE stocks ADD COLUMN roster_category TEXT;

ALTER TABLE stocks ADD CONSTRAINT stocks_roster_category_check
  CHECK (roster_category IN ('core', 'growth', 'value', 'watch', 'sell'));

-- Create roster_history table for change tracking
CREATE TABLE roster_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  from_category TEXT,
  to_category TEXT NOT NULL CHECK (to_category IN ('core', 'growth', 'value', 'watch', 'sell')),
  reason TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security for roster_history
ALTER TABLE roster_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own roster history" ON roster_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roster history" ON roster_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for lookups
CREATE INDEX idx_roster_history_stock_id ON roster_history (stock_id);
CREATE INDEX idx_roster_history_changed_at ON roster_history (changed_at);
