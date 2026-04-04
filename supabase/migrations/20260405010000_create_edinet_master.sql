-- EDINET マスタテーブル（システム共通、RLSなし）
-- 全上場企業の有報から抽出済みの財務データを保持する。
-- ユーザーはここを参照し、自分の financial_data にコピーする。
CREATE TABLE edinet_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id TEXT NOT NULL UNIQUE,
  sec_code TEXT NOT NULL,
  edinet_code TEXT,
  filer_name TEXT NOT NULL,
  doc_description TEXT,
  period_start DATE,
  period_end DATE,
  fiscal_year INTEGER NOT NULL,
  accounting_standard TEXT,

  -- 抽出済み財務データ（円単位）
  revenue NUMERIC,
  operating_income NUMERIC,
  net_income NUMERIC,
  total_assets NUMERIC,
  equity NUMERIC,
  interest_bearing_debt NUMERIC,
  operating_cf NUMERIC,
  investing_cf NUMERIC,
  shares_outstanding NUMERIC,
  interest_expense NUMERIC,
  cash_and_equivalents NUMERIC,
  current_assets NUMERIC,
  investments_and_other_assets NUMERIC,
  current_liabilities NUMERIC,
  non_current_liabilities NUMERIC,
  shareholders_equity NUMERIC,

  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'done', 'error')),
  error_message TEXT,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLSなし（システム共通データ、全認証済みユーザーが参照可能）
-- ただしSELECTのみ許可する
ALTER TABLE edinet_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read edinet master" ON edinet_master
  FOR SELECT USING (auth.role() = 'authenticated');

-- インデックス
CREATE INDEX idx_edinet_master_sec_code ON edinet_master (sec_code);
CREATE INDEX idx_edinet_master_fiscal_year ON edinet_master (fiscal_year DESC);
CREATE INDEX idx_edinet_master_extraction_status ON edinet_master (extraction_status);
