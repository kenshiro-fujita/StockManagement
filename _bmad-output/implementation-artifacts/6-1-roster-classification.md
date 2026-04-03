# Story 6.1: ロースター分類の設定と表示

Status: review

## Story

As a ログイン済みユーザー,
I want 銘柄をロースターカテゴリ（コア保有・成長枠・割安待機・様子見・売却検討）に分類したい,
so that 投資判断の優先度を可視化し、銘柄管理を効率化できる。（FR5）

## Acceptance Criteria

1. **Given** 銘柄詳細ページが表示されている **When** ロースターカテゴリのセレクトを変更して理由を入力し保存する **Then** 分類が更新され、変更履歴が記録される
2. **Given** 銘柄が未分類の状態 **When** 初めてカテゴリを設定する **Then** from_category が NULL の履歴レコードが作成される
3. **Given** 銘柄一覧ページを表示している **When** 各銘柄を確認する **Then** 現在のロースターカテゴリがバッジで表示されている
4. **Given** サイドバーが表示されている **When** 銘柄リストを確認する **Then** 各銘柄名の横にロースターカテゴリの略称が表示される
5. **Given** ロースター分類フォームを表示している **When** 変更理由を空のまま送信しようとする **Then** バリデーションエラーが表示される
6. **Given** ロースター分類フォームを操作している **When** キーボードのみで操作する **Then** すべての要素にフォーカスが移動でき、操作が完了できる

## Tasks / Subtasks

- [x] Task 1: DBマイグレーション（AC: #1, #2）
  - [x] `roster_history` テーブル作成（id, user_id, stock_id, from_category, to_category, reason, changed_at）
  - [x] `stocks` テーブルに `roster_category` カラム追加（TEXT、NULLable）
  - [x] RLS ポリシー設定
  - [x] CHECK制約（category IN ('core', 'growth', 'value', 'watch', 'sell')）

- [x] Task 2: 型定義・スキーマ（AC: #5）
  - [x] `src/lib/types/roster.ts` — RosterCategory 型、RosterHistoryRow 型
  - [x] `src/lib/schemas/roster.ts` — Zod スキーマ + カテゴリラベル定数

- [x] Task 3: Server Action（AC: #1, #2）
  - [x] `src/actions/roster.ts` — updateRosterCategory（分類更新 + 履歴同時書き込み）

- [x] Task 4: 銘柄詳細ページへの分類UI追加（AC: #1, #2, #5, #6）
  - [x] `src/components/stocks/roster-section.tsx` — カテゴリ選択 + 理由入力フォーム
  - [x] 銘柄詳細ページの概要セクションに統合

- [x] Task 5: 一覧・サイドバーへのカテゴリ表示（AC: #3, #4）
  - [x] StockTable にロースターカテゴリ列追加（バッジ表示）
  - [x] AppSidebar にロースターカテゴリ略称表示
  - [x] page.tsx / layout.tsx のクエリ拡張

- [x] Task 6: テスト
  - [x] Zod スキーマのバリデーションテスト（15テスト）
  - [x] カテゴリラベル・色定義の網羅テスト

## Dev Notes

### DB設計方針

**`stocks` テーブルにカラム追加（正規化よりシンプルさ優先）:**
- `roster_category TEXT` — NULL許容（未分類状態）
- CHECK制約: `('core', 'growth', 'value', 'watch', 'sell')`
- 別テーブルにしない理由: 1ユーザー1銘柄に1分類しかないため、stocks に直接持つほうがクエリが簡潔

**`roster_history` テーブル（変更履歴）:**
- 変更のたびに INSERT（Story 6.2 で閲覧機能を実装予定）
- `from_category` は初回分類時 NULL
- `reason` は必須（変更理由の記録がFR6の要件）

### カテゴリ定義

| DB値 | 日本語ラベル | 略称 | バッジ色 | 用途 |
|------|-------------|------|---------|------|
| `core` | コア保有 | コア | blue | 長期保有の中心銘柄 |
| `growth` | 成長枠 | 成長 | green | 成長期待で保有 |
| `value` | 割安待機 | 割安 | amber | 割安で購入タイミング待ち |
| `watch` | 様子見 | 様子 | gray | 監視中、追加分析必要 |
| `sell` | 売却検討 | 売却 | red | 売却を検討中 |

### Server Action パターン

既存の `src/actions/stocks.ts` と同じパターン:
```typescript
// 1. Zod safeParse
// 2. supabase.auth.getUser()
// 3. DB操作（stocks UPDATE + roster_history INSERT）
// 4. revalidatePath('/stocks')
// 5. return { success, error?, data? }
```

分類更新時は stocks.roster_category の UPDATE と roster_history への INSERT を同時実行。Supabase は RLS で自動的にユーザー制約をかける。

### UI統合

**銘柄詳細ページ:**
- 銘柄概要セクション（既存の stock_code, company_name 表示エリア）にインラインでカテゴリ表示 + 変更ボタン
- または StockDetailTabs に「ロースター」タブ追加
- → 推奨: 概要エリアにバッジ + クリックで変更ダイアログ（Select + Textarea）

**銘柄一覧テーブル:**
- 既存の StockTable に `roster_category` 列を追加
- Badge コンポーネントでカラー表示

**サイドバー:**
- 銘柄名の横にカテゴリ略称（2文字）を表示
- 既存の理論株価表示と並列

### Project Structure Notes

- `src/actions/roster.ts` — 新規作成（既存パターン準拠）
- `src/lib/schemas/roster.ts` — 新規作成
- `src/lib/types/roster.ts` — 新規作成
- `src/components/stocks/roster-section.tsx` — 新規作成
- `src/components/stocks/stock-table.tsx` — 列追加（型拡張）
- `src/components/layout/app-sidebar.tsx` — SidebarStock 型拡張
- `src/app/stocks/page.tsx` — クエリに roster_category 追加
- `src/app/stocks/layout.tsx` — クエリに roster_category 追加
- `src/app/stocks/[id]/page.tsx` — RosterSection 追加
- `supabase/migrations/YYYYMMDDHHMMSS_add_roster_classification.sql` — 新規

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 6, FR5, FR6]
- [Source: _bmad-output/planning-artifacts/architecture.md — DB設計、RLSパターン]
- [Source: src/actions/stocks.ts — Server Action パターン]
- [Source: src/lib/schemas/financial-data.ts — Zod enum パターン]
- [Source: supabase/migrations/ — マイグレーション命名規則]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- DB: stocks テーブルに roster_category カラム追加、roster_history テーブル新規作成（RLS付き）
- 型・スキーマ: RosterCategory 型、UpdateRosterInput Zod スキーマ、5カテゴリのラベル・略称・バッジスタイル定数
- Server Action: updateRosterCategory — 分類更新 + 履歴同時書き込み、同一カテゴリ変更の拒否
- UI: 銘柄詳細の概要セクションにバッジ + 変更フォーム（Select + Textarea）、React Hook Form + Zod バリデーション
- 一覧: StockTable にロースター列（バッジ表示）、サイドバーにカテゴリ略称表示
- テスト: 15テスト（スキーマバリデーション + 定数網羅）、全243テスト合格
- アクセシビリティ: shadcn/ui Form（aria-describedby）、Select（Radix UI）、キーボード操作対応

### File List

- `supabase/migrations/20260402000000_add_roster_classification.sql` (new)
- `src/lib/types/roster.ts` (new)
- `src/lib/schemas/roster.ts` (new)
- `src/lib/schemas/roster.test.ts` (new)
- `src/actions/roster.ts` (new)
- `src/components/stocks/roster-section.tsx` (new)
- `src/components/ui/textarea.tsx` (new — shadcn/ui)
- `src/components/stocks/stock-table.tsx` (modified)
- `src/components/layout/app-sidebar.tsx` (modified)
- `src/app/stocks/[id]/page.tsx` (modified)
- `src/app/stocks/page.tsx` (modified)
- `src/app/stocks/layout.tsx` (modified)
