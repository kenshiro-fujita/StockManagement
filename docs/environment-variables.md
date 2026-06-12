# 環境変数一覧

フェーズ0（セキュリティ改修）以降に必要な環境変数の一覧。`.env.local`（ローカル）と Vercel の環境変数設定に反映すること。

## 必須（既存）

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 公開キー（anon/publishable） |
| `NEXT_PUBLIC_ADMIN_PATH` | 管理画面のパス名（非推測URL。例: `ops-819a1ec26e72`） |

## 新規（フェーズ0で追加）

| 変数 | 用途 | 備考 |
|---|---|---|
| `SETTINGS_ENCRYPTION_KEY` | user_settings の APIキー暗号化鍵（AES-256-GCM） | **本番では必須**。32バイトを base64 した値。生成: `openssl rand -base64 32`。未設定の場合、開発では警告つき平文保存、本番では保存エラーになる |
| `NEXT_PUBLIC_DEV_LOGIN_USER_EMAIL` | 開発用ワンクリックログイン（通常モード）のメール | **開発環境のみ設定**。本番に設定しないこと |
| `NEXT_PUBLIC_DEV_LOGIN_USER_PASSWORD` | 同パスワード | 同上 |
| `NEXT_PUBLIC_DEV_LOGIN_ADMIN_EMAIL` | 開発用ワンクリックログイン（管理者モード）のメール | 同上 |
| `NEXT_PUBLIC_DEV_LOGIN_ADMIN_PASSWORD` | 同パスワード | 同上 |

## 任意（フォールバック）

| 変数 | 用途 |
|---|---|
| `EDINET_API_KEY` | EDINET APIキー。ユーザーが設定画面で登録していない場合のフォールバック |
| `ANTHROPIC_API_KEY` | Anthropic APIキー。同上 |

## 注意事項

- `NEXT_PUBLIC_` プレフィックスの変数はクライアントバンドルに埋め込まれる。機密を入れないこと（開発用ログイン変数は「開発ビルドのみ」が前提）。
- 鍵のローテーション時は、`SETTINGS_ENCRYPTION_KEY` を変えると既存の暗号化済み設定値が復号できなくなる。ローテーションする場合は各ユーザーがAPIキーを再保存する必要がある。
