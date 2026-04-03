-- EDINET書類メタデータテーブル
CREATE TABLE edinet_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID REFERENCES stocks(id) ON DELETE SET NULL,
  doc_id TEXT NOT NULL,
  sec_code TEXT,
  edinet_code TEXT,
  filer_name TEXT,
  doc_type_code TEXT,
  doc_description TEXT,
  file_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  xbrl_flag TEXT DEFAULT '0',
  csv_flag TEXT DEFAULT '0',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 同じユーザーが同じdocIDを重複登録しない
ALTER TABLE edinet_documents ADD CONSTRAINT edinet_documents_user_doc_unique
  UNIQUE (user_id, doc_id);

-- Row Level Security
ALTER TABLE edinet_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own edinet documents" ON edinet_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own edinet documents" ON edinet_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own edinet documents" ON edinet_documents
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own edinet documents" ON edinet_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_edinet_documents_user_id ON edinet_documents (user_id);
CREATE INDEX idx_edinet_documents_stock_id ON edinet_documents (stock_id);
CREATE INDEX idx_edinet_documents_doc_id ON edinet_documents (doc_id);
CREATE INDEX idx_edinet_documents_sec_code ON edinet_documents (sec_code);
