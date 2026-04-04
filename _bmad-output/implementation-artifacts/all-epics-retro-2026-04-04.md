# 全Epic レトロスペクティブ（Epic 1〜8）

Date: 2026-04-04

## プロジェクトサマリー

| 項目 | 値 |
|------|-----|
| 完了Epic数 | 8 / 8（100%） |
| 完了Story数 | 27 |
| テスト数 | 289（全合格） |
| DBテーブル数 | 6（stocks, financial_data, parameters, roster_history, edinet_documents, extraction_logs, ai_research） |
| マイグレーション数 | 9 |
| 本番インシデント | 0 |
| 技術的負債（重大） | 0 |

---

## うまくいったこと

### 1. パターンの一貫性
Epic 1 で確立した設計パターンが最後まで崩れなかった。
- Server Action の戻り値型: `{ success, error?, data? }`
- Zod スキーマの共有（フロント/サーバー）
- RLS ポリシーの一貫した適用
- shadcn/ui Form + aria-describedby のアクセシビリティパターン

### 2. 計算エンジンの透明性設計（Epic 4）
全26指標が `CalcResult<T>` 型で「値 + メタデータ（数式・入力参照・端数処理・calc_version）」を返す設計により、CalcLogicPanel でユーザーが計算過程を検証できる。この設計はアプリの信頼性の核となっている。

### 3. 3LLM クロスチェックによるEDINETリサーチ（Epic 5）
Claude / Gemini / ChatGPT の3つのレポートを突き合わせたことで、以下の重要な発見ができた：
- CSV が UTF-16LE + TSV（ChatGPT が指摘）
- iXBRL の scale/sign 属性の落とし穴（3者全員が強調）
- Supabase Edge Functions 150秒タイムアウト（Gemini が指摘）
- edinet-ts（TypeScript移植版）の存在（ChatGPT が発見）

### 4. ゴールデンテストの安定性
Epic 4.2 で作成したゴールデンテスト（1銘柄×3期）が、その後の全ての計算ロジック変更で一度も壊れなかった。端数処理・単位変更（億円→10億円）でも正確に検出できた。

### 5. 小刻みなコミット＆Push
ストーリー単位でコミットし、こまめに push する運用ができた。Epic 4 だけで6コミットに分割し、各コミットが独立してレビュー可能だった。

### 6. アクセシビリティ
Story 1.2 以降、WCAG 2.1 Level AA を意識した実装が一貫して行われた。セマンティックHTML、キーボード操作、フォーカス管理、色＋テキスト冗長性がすべて網羅されている。

---

## 課題・改善点

### 1. zodResolver の型安全性ギャップ
`z.input` と `z.output` の型不一致で `as any` ワークアラウンドが複数箇所にある。Zod v4 + React Hook Form の組み合わせで根本解決が必要。

### 2. コンポーネントテストの不足
@testing-library/react が未導入のため、UIコンポーネントのテストが純粋関数のユニットテストに限られている。theory-price-section の detectChangedFields テストはあるが、レンダリングテストがない。

### 3. EDINET CSV の実データ検証が未実施
CSVパーサーのテストはモックデータで行っているが、実際の EDINET CSV データでの E2E 検証がまだ。企業ごとの勘定科目の揺れが想定通りに処理できるか、実データで確認する必要がある。

### 4. Server/Client 境界の混乱
Story 4.5 で `getValuationLevel` が `'use client'` コンポーネントに定義されていたため、Server Component の StockTable からインポートできなかったバグがあった。この種の境界ミスは今後も起きうる。

### 5. ストーリーファイルの status 更新漏れ
一部のストーリーファイルで status が `ready-for-dev` のまま残っている（実装は完了済み）。ワークフローの最終ステップで更新し忘れたケースがある。

### 6. ページコンポーネントの肥大化
`src/app/stocks/page.tsx` と `src/app/stocks/layout.tsx` で、3テーブル並列クエリ → グループ化 → 計算というロジックが重複している。共通のデータ取得関数に切り出すべきだった。

---

## 発見・学び

### 1. 「まず CSV、次に XBRL」の段階的アプローチ
3LLM 全てが推奨した「CSV (type=5) 先行」戦略は正しかった。CSV パーサーは XBRLパーサーの1/3のコード量で、同等の抽出精度を達成できた。

### 2. AI プロバイダーの抽象化は早めにやるべき
Epic 8 の AIProvider インターフェースは3ファイル・50行程度の追加で実現できた。この程度の抽象化コストなら、最初から入れておいても良かった。

### 3. EDINET のレート制限は「紳士協定」
EDINET API 仕様書にはレート制限の明示的な数値がない。3〜5秒間隔のスリープで運用しているが、大量検索時はキューイング（Vercel Cron + Supabase Edge Functions）への移行が必要。

### 4. 個人開発 × AI 駆動の生産性
Epic 1〜8（27ストーリー、289テスト）を短期間で実装できたのは、BMAD ワークフロー（create-story → dev-story → code-review サイクル）による文脈の一貫性が大きい。ストーリーファイルの Dev Notes が「AIへの引き継ぎ書」として機能した。

---

## 技術的負債の棚卸し

| 項目 | 優先度 | 影響 |
|------|--------|------|
| zodResolver `as any` ワークアラウンド | 中 | 型安全性の穴 |
| @testing-library/react 未導入 | 中 | UIテスト不足 |
| page.tsx / layout.tsx のクエリ重複 | 低 | コード重複 |
| EDINET 実データ E2E テスト | 高 | 抽出精度の未検証 |
| Vercel デプロイ未実施 | 高 | 本番環境なし |
| CI/CD 未構築 | 高 | 自動テスト/ビルドなし |

---

## 次のアクション

| アクション | 優先度 |
|-----------|--------|
| CI/CD 構築（GitHub Actions: 型チェック + ESLint + Vitest + ビルド） | 高 |
| Vercel デプロイ + 環境変数設定 | 高 |
| EDINET 実データでの E2E 検証 | 高 |
| @testing-library/react 導入 + UIテスト追加 | 中 |
| page.tsx / layout.tsx のデータ取得ロジック共通化 | 低 |

---

## Epic 別の振り返り一言

| Epic | 一言 |
|------|------|
| 1. 認証基盤 | Supabase Auth + RLS の組み合わせが堅牢。全Epicの基盤になった |
| 2. 銘柄管理 | CRUD パターンの確立。以降の全機能がこのパターンに従った |
| 3. 財務データ | 入力バリデーションが最も複雑。Zod superRefine が活躍 |
| 4. 理論株価 | プロジェクトの核。計算透明性メタデータの設計が最大の成果 |
| 5. EDINET連携 | 鬼門を突破。3LLM リサーチ + CSV先行戦略が奏功 |
| 6. ロースター | シンプルだが実用的。stocks テーブルへの直接追加が正解だった |
| 7. 銘柄比較 | 最良値ハイライトのロジックがクリーン。findBestIndex は再利用性高い |
| 8. AI調査 | AIProvider 抽象化が50行で完結。拡張性は十分 |
