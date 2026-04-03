-- 抽出ログテーブル（FR15: データ判定の過程を記録）
CREATE TABLE extraction_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  metric_key TEXT NOT NULL,
  matched_tag TEXT,
  context_id TEXT,
  raw_value TEXT,
  normalized_value NUMERIC,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  accounting_standard TEXT,
  source_type TEXT CHECK (source_type IN ('csv', 'xbrl', 'manual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE extraction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own extraction logs" ON extraction_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extraction logs" ON extraction_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_extraction_logs_stock_id ON extraction_logs (stock_id);
CREATE INDEX idx_extraction_logs_doc_id ON extraction_logs (doc_id);
CREATE INDEX idx_extraction_logs_metric_key ON extraction_logs (metric_key, stock_id);
