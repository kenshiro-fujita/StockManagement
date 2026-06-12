-- edinet_master への書き込みを管理者ロールに限定する
--
-- 背景: 旧ポリシーは authenticated 全員に INSERT/UPDATE を許可していたため、
-- 任意の認証ユーザーが全ユーザー共通の財務マスタを書き換え・汚染できた。
-- マスタへの書き込みは管理画面のバッチ取得（管理者）のみが行う。
--
-- ロール判定は JWT の app_metadata.role を参照する
-- （20260613000000 で user_metadata から移行済み。user_metadata は自己書換可能なので使わない）

DROP POLICY IF EXISTS "Authenticated users can insert edinet master" ON edinet_master;
DROP POLICY IF EXISTS "Authenticated users can update edinet master" ON edinet_master;

CREATE POLICY "Admins can insert edinet master" ON edinet_master
  FOR INSERT WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update edinet master" ON edinet_master
  FOR UPDATE USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
