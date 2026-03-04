# CLAUDE.md - プロジェクト指示書

## プロジェクト概要

- **プロジェクト名**: StockManagement
- **概要**: 株式投資の財務分析アプリ（スプレッドシートからの移行）
- **対象**: 中長期保有の個人投資家向け
- **開発者**: Fujita Kenshirou
- **開発手法**: BMAD-METHOD によるアジャイルAI駆動開発

## コミュニケーション

- 日本語でやりとりすること
- コミットメッセージ・PRタイトルは英語（conventional commits 形式）
- GitHub Issues のタイトルは英語、本文は日本語可
- カスタマイズ・設定変更の内容は都度ユーザーに確認すること。特に以下は必ず事前確認する：
  - DBスキーマ変更（テーブル/カラム/制約）
  - 認証方式変更
  - 外部API追加/変更（EDINET、株価、AI API等）
  - 権限設定（.claude/settings*、RLS）
  - デプロイ設定（Vercel環境変数、ビルド設定）
  - 既存計算ロジックの仕様変更（端数処理、単位、期ズレ含む）
- 敬語で返答する
- 体言止めは使わない。

## 開発フェーズ

```
0. アイデア出し → 1. 技術リサーチ → 2. 分析・計画 → 3. 設計 → 4. 実装 → 5. 振り返り
```

- 実装前に未知の技術があれば必ずリサーチフェーズを挟む
- 困ったら `/bmad-help` で次のステップを確認

## コミット規約

Conventional Commits 形式:

```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

## コーディング規約

- テストは実装と同時に書く（TDD推奨）
- `.env` や秘密情報はコミットしない
- セキュリティ（OWASP Top 10）を意識したコード
- セマンティックHTMLを優先する。`<button>`, `<table>`, `<nav>`, `<main>`, `<label>` 等の標準タグを正しく使い、ARIAによる後付けを最小限にする（WCAG 2.1 Level AA 準拠）
- すべての主要指標は「数式」「入力参照（期・単位）」「端数処理」「calc_version」を表示できることを前提に実装する
- 計算エンジンの変更は、既存のゴールデンテスト（1銘柄×3期）を必ず通す。差分が出た場合は、端数処理・単位・期ズレ・入力マッピングのいずれかとして理由を明記する
- UIのPRでは、最低限「キーボード操作」「フォーカス可視」「フォームエラーの読み上げ（aria-describedby等）」をセルフチェックする

## ブランチ戦略

- `main` — 本番ブランチ（直接pushしない）
- `feature/<issue番号>-<簡潔な説明>` — 機能開発
- `fix/<issue番号>-<簡潔な説明>` — バグ修正
- `chore/<説明>` — メンテナンス作業

## Pull Requests

- 1 Issue = 1 PR を原則とする
- PR 作成時は Issue 番号を紐付ける（`Closes #<番号>`）

## ファイル構成

```
StockManagement/
├── .claude/                  # Claude Code 設定
│   └── settings.local.json   # ローカル権限設定
├── .claudeignore             # Claude 除外設定
├── docs/                     # プロジェクトドキュメント
└── CLAUDE.md                 # このファイル
```

※ 技術スタック決定後に構成を更新すること
