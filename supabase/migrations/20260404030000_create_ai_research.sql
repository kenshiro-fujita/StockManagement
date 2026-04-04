-- AI調査結果テーブル
CREATE TABLE ai_research (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  business_overview TEXT NOT NULL DEFAULT '',
  competitive_position TEXT NOT NULL DEFAULT '',
  strengths_and_risks TEXT NOT NULL DEFAULT '',
  recent_news TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  researched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_research ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own ai research" ON ai_research
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai research" ON ai_research
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai research" ON ai_research
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ai_research_stock_id ON ai_research (stock_id);
CREATE INDEX idx_ai_research_researched_at ON ai_research (researched_at DESC);
