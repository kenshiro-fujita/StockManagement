# Story 4.5: 銘柄一覧への理論株価・主要指標表示

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ログイン済みユーザー,
I want 銘柄一覧で各銘柄の理論株価・主要指標を一目で確認したい,
so that 一覧レベルで投資候補の比較ができる。（FR4）

## Acceptance Criteria

1. **AC1: 銘柄一覧テーブルに理論株価・安全率を表示**
   - Given 銘柄に財務データとパラメータが登録されている
   - When 銘柄一覧ページ（`/stocks`）を表示する
   - Then Epic 2 で確保したプレースホルダー部分に、現状理論株価と安全率が表示される

2. **AC2: 財務データ未入力時の空状態表示**
   - Given 銘柄に財務データが未入力の場合
   - When 銘柄一覧で該当銘柄を確認する
   - Then 指標部分は「—」（ダッシュ）で表示される

3. **AC3: サイドバーに理論株価サマリーを表示**
   - Given サイドバーが表示されている
   - When 銘柄リストを確認する
   - Then 各銘柄名の横に現状理論株価が表示される（スペースが限られるため安全率は省略可）

4. **AC4: パフォーマンス（NFR2）**
   - Given 50銘柄が登録されている
   - When 銘柄一覧ページを表示する
   - Then 1秒以内にレンダリングが完了する（N+1 問題を回避した効率的なクエリ）

## Tasks / Subtasks

- [ ] Task 1: 銘柄一覧のデータ取得拡張（AC: #1, #2, #4）
  - [ ] 1.1 `page.tsx` の Supabase クエリを拡張して、各銘柄の最新財務データとパラメータを一括取得
  - [ ] 1.2 取得データを銘柄ごとにグループ化し、`calculateAllIndicators()` で指標を計算
  - [ ] 1.3 計算結果を `StockTable` に渡す型・Props を拡張
- [ ] Task 2: StockTable コンポーネントの指標表示（AC: #1, #2）
  - [ ] 2.1 `StockTable` の `Stock` 型に理論株価・安全率のフィールドを追加
  - [ ] 2.2 プレースホルダー「—」を実際の値またはフォーマット済み文字列に置換
  - [ ] 2.3 安全率に応じた色分け（割安=緑、適正=黄、割高=赤）を追加
- [ ] Task 3: サイドバーの理論株価サマリー（AC: #3）
  - [ ] 3.1 `layout.tsx` のサイドバー用クエリを拡張して財務データ・パラメータを取得
  - [ ] 3.2 `AppSidebar` の `SidebarStock` 型に理論株価を追加
  - [ ] 3.3 サイドバーの「—」プレースホルダーを理論株価表示に置換
- [ ] Task 4: テスト（AC: #1-#4）
  - [ ] 4.1 指標計算の正常系テスト（既存ゴールデンテストで担保）
  - [ ] 4.2 空データ時の表示テスト（null / 未入力時に「—」が返ること）

## Dev Notes

### 現在のアーキテクチャと実装ポイント

**現在のデータフロー:**

```
page.tsx (Server Component)
  ├── stocks テーブルのみクエリ（id, stock_code, company_name, market, sector）
  └── StockTable にそのまま渡し → 理論株価・安全率は「—」固定

layout.tsx (Server Component)
  ├── stocks テーブルのみクエリ（id, stock_code, company_name）
  └── AppSidebar にそのまま渡し → 銘柄名横は「—」固定
```

**目標のデータフロー:**

```
page.tsx (Server Component)
  ├── stocks + 最新 financial_data + parameters を一括クエリ
  ├── 銘柄ごとに calculateAllIndicators() を実行
  └── StockTable に計算結果付きデータを渡す

layout.tsx (Server Component)
  ├── stocks + 最新 financial_data + parameters を一括クエリ
  ├── 銘柄ごとに calculateAllIndicators() を実行
  └── AppSidebar にサマリーデータを渡す
```

### 効率的なクエリ設計（NFR2: 50銘柄1秒以内）

**問題**: 銘柄ごとに個別クエリ（N+1）は絶対に避ける。

**推奨パターン**: 3テーブルを並列クエリし、JS 側でマージする。

```typescript
// page.tsx (Server Component)
const [{ data: stocks }, { data: allFinancialData }, { data: allParameters }] = await Promise.all([
  supabase.from('stocks').select('id, stock_code, company_name, market, sector').order('created_at', { ascending: false }),
  supabase.from('financial_data').select('*').order('fiscal_year', { ascending: false }),
  supabase.from('parameters').select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier'),
]);

// JS 側で stock_id ごとにグループ化
const financialByStock = groupBy(allFinancialData ?? [], 'stock_id');
const paramsByStock = keyBy(allParameters ?? [], 'stock_id');

// 銘柄ごとに計算
const stocksWithIndicators = (stocks ?? []).map((stock) => {
  const fd = financialByStock[stock.id] ?? [];
  const params = paramsByStock[stock.id] ?? null;
  // ... calculateAllIndicators(fd, params) で指標取得
});
```

**Supabase RLS**: `financial_data` と `parameters` には RLS ポリシーがあり、`user_id` によるフィルタリングが自動適用されるため、明示的な WHERE 条件は不要。

### StockTable の Props 拡張

```typescript
// 現在
type Stock = {
  id: string;
  stock_code: string;
  company_name: string;
  market: string | null;
  sector: string | null;
};

// 拡張後
type Stock = {
  id: string;
  stock_code: string;
  company_name: string;
  market: string | null;
  sector: string | null;
  theoryPrice: number | null;      // 現状理論株価（円）
  safetyRateCurrent: number | null; // 安全率（%）
};
```

### サイドバーの表示パターン

サイドバーはスペースが限られているため（`--sidebar-width: 15rem`）、理論株価のみコンパクトに表示する。

```typescript
// 現在
type SidebarStock = {
  id: string;
  stock_code: string;
  company_name: string;
};

// 拡張後
type SidebarStock = {
  id: string;
  stock_code: string;
  company_name: string;
  theoryPrice: number | null; // 現状理論株価
};
```

表示例: `¥2,150` または `—`（フォーマットは `formatStockPrice()` を使用）

### 安全率の色分け

`theory-price-section.tsx` の `getValuationLevel()` を再利用する:
- 安全率 > 0: 緑（割安）
- -10 ≤ 安全率 ≤ 0: 黄（適正）
- 安全率 < -10: 赤（割高）

テーブルの安全率セルにテキスト色を適用する（背景ではなくテキスト色）。

### `calculateAllIndicators()` の注意事項

- **引数**: `financialData` は降順ソート済みの配列（[0]が最新期）、`parameters` は ParametersRow
- **パラメータ未作成の銘柄**: `parameters` が null の場合は指標を計算できない → `null` として扱う
- **計算実行場所**: Server Component 内で実行（SSR）。クライアントバンドルへの影響なし
- **パフォーマンス**: 1銘柄あたり約10ms 以下 → 50銘柄でも500ms 以下で完了
- **エラーハンドリング**: `try-catch` で囲み、失敗時は `null`（Story 4.3 コードレビューの学び）

### Supabase NUMERIC → number 変換

`parameters` テーブルの値は Supabase から **文字列** として返る（NUMERIC 型のため）。`Number()` で変換が必要。`page.tsx`（Story 4.4）の既存パターンを参照:

```typescript
const initialParameters = parametersData
  ? {
      id: parametersData.id as string,
      stock_id: parametersData.stock_id as string,
      discount_rate: Number(parametersData.discount_rate),
      growth_rate: Number(parametersData.growth_rate),
      tax_rate: Number(parametersData.tax_rate),
      cap_multiplier: Number(parametersData.cap_multiplier),
    }
  : null;
```

### Tailwind v3/v4 注意事項

プロジェクトは **Tailwind v3.4.1** を使用。v4 構文を使わないこと。

### Story 4.4 コードレビューからの反映事項

- `calculateAllIndicators()` は必ず `try-catch` で囲む
- フォーマッタは `round2()` で浮動小数点誤差を処理済み — そのまま使用
- `getValuationLevel()` は `theory-price-section.tsx` からエクスポート済み

### Project Structure Notes

変更ファイル:
- `src/app/stocks/page.tsx` — クエリ拡張 + 計算 + Props 拡張
- `src/components/stocks/stock-table.tsx` — 型拡張 + 値表示 + 色分け
- `src/app/stocks/layout.tsx` — サイドバー用クエリ拡張
- `src/components/layout/app-sidebar.tsx` — 型拡張 + 理論株価表示

新規ファイル:
- なし（既存コンポーネントの拡張のみ）

既存パターンとの整合:
- `StockTable` の既存テーブル構造を維持（列の追加のみ）
- `AppSidebar` の既存 SidebarMenuButton 構造を維持
- フォーマッタ（`formatStockPrice`, `formatPercent`）は `src/lib/format.ts` から import
- `getValuationLevel()` は `theory-price-section.tsx` から import

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.5]
- [Source: _bmad-output/planning-artifacts/prd.md — FR4, NFR2]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — StockListView, プログレッシブ・ディスクロージャー]
- [Source: src/app/stocks/page.tsx — 現在の銘柄一覧クエリ]
- [Source: src/components/stocks/stock-table.tsx — 現在のプレースホルダー]
- [Source: src/components/layout/app-sidebar.tsx — 現在のサイドバー]
- [Source: src/app/stocks/layout.tsx — サイドバーデータ取得]
- [Source: src/lib/calc/index.ts — calculateAllIndicators()]
- [Source: src/components/stocks/theory-price-section.tsx — getValuationLevel()]
- [Source: _bmad-output/implementation-artifacts/4-4-realtime-recalculation.md — 前ストーリーの実装詳細]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-25 | Story creation — ultimate context engine | Story 4.5 context engine |

### File List
