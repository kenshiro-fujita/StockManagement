# Story 7.2: 5段階評価と購入優先順

Status: ready-for-dev

## Story

As a ログイン済みユーザー,
I want 各銘柄に5段階評価を設定し、購入優先順を手動で管理したい,
so that 複数銘柄を相対的に評価し、次に購入すべき銘柄を明確にできる。（FR25, FR26）

## Acceptance Criteria

1. **Given** 銘柄詳細ページが表示されている **When** 5段階評価（★1〜★5）を設定する **Then** 評価が保存され表示に反映される
2. **Given** 銘柄詳細ページが表示されている **When** 購入優先順（整数、1が最優先）を設定する **Then** 優先順が保存される
3. **Given** 銘柄一覧ページを表示している **When** 評価と優先順を確認する **Then** 各銘柄の評価（★）と優先順が表示される
4. **Given** 比較ページが表示されている **When** 基本情報を確認する **Then** 各銘柄の評価と優先順が横並びで表示される
5. **Given** 評価を入力する **When** キーボードで操作する **Then** ★評価をキーボードで設定できる

## Tasks / Subtasks

- [ ] Task 1: DBマイグレーション
  - [ ] stocks テーブルに `rating` (INTEGER, 1-5, NULL可) と `buy_priority` (INTEGER, NULL可) カラム追加

- [ ] Task 2: 型定義・スキーマ
  - [ ] roster.ts に rating/buy_priority の型拡張
  - [ ] Zod スキーマ追加（updateRatingSchema, updateBuyPrioritySchema）

- [ ] Task 3: Server Action
  - [ ] updateStockRating — 評価更新
  - [ ] updateBuyPriority — 優先順更新

- [ ] Task 4: 銘柄詳細の評価UI
  - [ ] StarRating コンポーネント（クリック + キーボード対応）
  - [ ] 優先順入力（数値フィールド）
  - [ ] 銘柄詳細ページの概要セクションに統合

- [ ] Task 5: 一覧・比較への表示追加
  - [ ] StockTable に評価列と優先順列を追加
  - [ ] ComparisonTable に評価と優先順の行を追加
  - [ ] page.tsx クエリに rating, buy_priority 追加

- [ ] Task 6: テスト
  - [ ] Zod スキーマのバリデーションテスト

## Dev Notes

### DB設計

stocks テーブルに直接追加:
- `rating INTEGER` — CHECK (rating >= 1 AND rating <= 5)、NULL可（未評価）
- `buy_priority INTEGER` — NULL可（未設定）、ユーザーが自由に1から連番を割り振る

### StarRating コンポーネント

- ★1〜★5 をクリックで設定
- キーボード: ←→キーで値変更、radiogroup パターン
- aria-label で「評価: ★3」等を読み上げ
- 未評価状態は灰色の☆表示

### 優先順

- シンプルな数値入力（1が最優先）
- 自動採番はしない（ユーザーが自由に設定）
- 同じ優先順を複数銘柄に設定しても問題なし

### References

- [Source: _bmad-output/planning-artifacts/epics.md — FR25, FR26]
- [Source: src/components/stocks/roster-section.tsx — 既存の銘柄詳細UI統合パターン]

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
