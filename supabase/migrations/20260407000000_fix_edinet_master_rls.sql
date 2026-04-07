-- edinet_master に INSERT/UPDATE ポリシーを追加
-- バッチ取得（Server Action）で認証済みユーザーが書き込めるようにする
CREATE POLICY "Authenticated users can insert edinet master" ON edinet_master
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update edinet master" ON edinet_master
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
