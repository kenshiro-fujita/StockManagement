-- 管理者ロールを user_metadata から app_metadata へ移行する
--
-- 背景: user_metadata（raw_user_meta_data）はユーザー自身が
-- auth.updateUser() で書き換え可能なため、ロール判定に使うと
-- 任意ユーザーが自分を admin に昇格できる脆弱性になる。
-- app_metadata（raw_app_meta_data）は service_role でのみ変更可能。

-- 既存の admin ロールを app_metadata へコピー
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE raw_user_meta_data ->> 'role' = 'admin';

-- user_metadata 側の role は撤去する（残すと「まだ有効」と誤解される温床になる）
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role';
