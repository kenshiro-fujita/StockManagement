-- 売買取引履歴テーブル
-- 中長期投資の「安く買い・高く売る」を記録し、保有ポジション・実現/未実現損益・
-- 売買シグナルを算出する基礎データ。1行＝1約定（買い or 売り）。
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,

  -- 取引種別: buy=買い, sell=売り
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  -- 約定日
  trade_date DATE NOT NULL,
  -- 約定株数（正の数）
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  -- 約定単価（円／株）
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  -- 手数料（円、税込）。買いは取得原価に加算、売りは受取額から減算する
  fee NUMERIC NOT NULL DEFAULT 0 CHECK (fee >= 0),
  -- 任意メモ（売買理由など）
  memo TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security（自分の取引のみ参照・編集可）
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- インデックス（銘柄ごと・日付順の集計が多い）
CREATE INDEX idx_transactions_user_id ON transactions (user_id);
CREATE INDEX idx_transactions_stock_id ON transactions (stock_id);
CREATE INDEX idx_transactions_stock_date ON transactions (stock_id, trade_date);

-- updated_at 自動更新（既存の共通トリガー関数を再利用）
CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
