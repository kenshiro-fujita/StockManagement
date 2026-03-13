# Story 2.2: 銘柄一覧表示

Status: done

## Story

As a ログイン済みユーザー,
I want 登録した銘柄の一覧を確認したい,
so that 自分のウォッチリストを把握できる。（FR3）

## Acceptance Criteria

1. **AC1: 銘柄一覧の表示**
   - Given ユーザーが1件以上の銘柄を登録している
   - When 銘柄一覧ページにアクセスする
   - Then 登録済み銘柄が一覧で表示される（銘柄コード、企業名、市場、業種）
   - And 将来の理論株価・主要指標表示用のカラムスペースが確保されており、「—」のプレースホルダーが表示される

2. **AC2: Empty State**
   - Given ユーザーが銘柄を1件も登録していない
   - When 銘柄一覧ページにアクセスする
   - Then Empty Stateとして「銘柄を登録して分析を始めましょう」のガイダンスと登録ボタンが表示される

3. **AC3: パフォーマンス**
   - Given 50件以上の銘柄が登録されている
   - When 銘柄一覧を表示する
   - Then 1秒以内にレンダリングが完了する（NFR2）

4. **AC4: サイドバー銘柄リスト連動**
   - Given サイドバーが表示されている
   - When 銘柄一覧を確認する
   - Then サイドバーの銘柄リストにも登録済み銘柄が反映されている

## Tasks / Subtasks

- [x] Task 1: Server Component で銘柄データ取得 (AC: #1, #3)
  - [x] 1.1 `src/app/stocks/page.tsx` を Server Component として書き換え、Supabase から stocks を SELECT する
  - [x] 1.2 stocks を `created_at DESC` でソートして取得する
  - [x] 1.3 銘柄が0件の場合は Empty State を表示する（既存の登録ボタン含む）

- [x] Task 2: 銘柄一覧テーブル UI (AC: #1, #2)
  - [x] 2.1 `src/components/stocks/stock-table.tsx` を作成する
    - shadcn/ui の Table コンポーネント使用
    - カラム: 銘柄コード、企業名、市場、業種、理論株価（プレースホルダー「—」）、安全率（プレースホルダー「—」）
    - セマンティック HTML（`<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`）
    - 数値カラムには `tabular-nums` を適用
  - [x] 2.2 各行に銘柄詳細ページ `/stocks/[id]` へのリンクを設定する（将来用、現時点では遷移先は空ページ）

- [x] Task 3: サイドバー銘柄リスト更新 (AC: #4)
  - [x] 3.1 `src/components/layout/app-sidebar.tsx` を更新して、登録済み銘柄をリスト表示する
    - Server Component からサイドバーにデータを渡す方式（stocks/layout.tsx でデータ取得してprops渡し、またはサイドバー内でServer Componentラップ）
    - 銘柄名の横に理論株価サマリー用のスペースを確保する（現時点は「—」表示）
    - 銘柄が0件の場合は既存の「銘柄を登録しましょう」テキストを維持する

- [x] Task 4: テストとビルド確認 (AC: #1, #2, #3, #4)
  - [x] 4.1 `npm run build` でビルド確認
  - [x] 4.2 Prettier/ESLint チェック

## Dev Notes

### データ取得パターン

architecture.md の方針に従い、**読み取りは Server Components 内で直接 Supabase クライアントを呼び出す**パターンを使用する。

```typescript
// src/app/stocks/page.tsx — Server Component パターン
import { createClient } from '@/lib/supabase/server';

export default async function StocksPage() {
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from('stocks')
    .select('id, stock_code, company_name, market, sector')
    .order('created_at', { ascending: false });

  if (!stocks || stocks.length === 0) {
    return <EmptyState />;
  }

  return <StockTable stocks={stocks} />;
}
```

### サイドバーのデータ渡しパターン

`app-sidebar.tsx` は現在 `'use client'` だが、銘柄データをサーバーから渡す必要がある。以下のアプローチを推奨する：

```typescript
// src/app/stocks/layout.tsx でデータ取得
export default async function StocksLayout({ children }) {
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from('stocks')
    .select('id, stock_code, company_name')
    .order('created_at', { ascending: false });

  return (
    <SidebarProvider ...>
      <AppSidebar stocks={stocks ?? []} />
      <SidebarInset>...</SidebarInset>
    </SidebarProvider>
  );
}
```

### 確立されたコードパターン（Story 2.1 から継承）

- **Server Action パターン**: `src/actions/stocks.ts` に `createStock` が既に実装済み。`revalidatePath('/stocks')` による再取得
- **Zod スキーマ**: `src/lib/schemas/stocks.ts` に `createStockSchema`, `MARKET_OPTIONS`, `SECTOR_OPTIONS` が定義済み
- **DB スキーマ**: `stocks` テーブル（id, user_id, stock_code, company_name, market, sector, business_segment, created_at, updated_at）
- **RLS**: `auth.uid() = user_id` パターン — Server Component で認証済みクライアントを使えば自動でフィルタリングされる
- **shadcn/ui**: Table, Button, Form 等が既にインストール済み
- **Toast**: sonner で `position="bottom-right"` 設定済み（`src/app/layout.tsx`）
- **ファイル命名**: ケバブケース
- **UI テキスト**: すべて日本語
- **インポート**: `@` パスエイリアス

### テーブルのレイアウト仕様（UX Design 準拠）

- **数値表示**: `tabular-nums`（等幅数字）を指定し、テーブル内の数値が縦に揃うようにする
- **テーブルセル**: 12px × 16px パディング
- **将来カラム**: 理論株価・安全率カラムは「—」で表示し、Epic 4（Story 4.5）で値を差し込む設計
- **レスポンシブ**: デスクトップファースト。モバイルではテーブルの水平スクロールを許容する

### Project Structure Notes

- `src/app/stocks/page.tsx` — MODIFY: Empty State のみ → Server Component でデータ取得 + テーブル表示
- `src/components/stocks/stock-table.tsx` — NEW: 銘柄一覧テーブルコンポーネント（Client Component）
- `src/components/layout/app-sidebar.tsx` — MODIFY: 銘柄リストを動的表示に変更
- `src/app/stocks/layout.tsx` — MODIFY: サイドバーにデータを渡すため Server Component でデータ取得

### 重要な注意事項

1. **Empty State は Story 2.1 で既に実装済み** — `src/app/stocks/page.tsx` に「銘柄を登録する」ボタンがある。このボタンを銘柄0件時の Empty State として維持すること
2. **`app-sidebar.tsx` は 'use client'** — サーバーサイドでデータを取得して props として渡す構成にすること。サイドバー自体は Client Component のまま維持する（usePathname, useState を使用しているため）
3. **`revalidatePath('/stocks')` が Story 2.1 の createStock で既に呼ばれている** — 銘柄登録後に一覧が自動的に最新化される仕組みは構築済み
4. **shadcn/ui Table は既にインストール済み** — `src/components/ui/table.tsx` が存在する。`npx shadcn add` は不要
5. **パフォーマンス（NFR2）**: 50銘柄以上の場合でも1秒以内にレンダリングする必要がある。Server Component でのデータ取得は RLS インデックス `idx_stocks_user_id` により高速

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.2 AC, FR3]
- [Source: _bmad-output/planning-artifacts/architecture.md — データアクセスパターン（Server Components）、プロジェクト構造]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — テーブル表示、tabular-nums、Empty State]
- [Source: _bmad-output/implementation-artifacts/2-1-stock-registration.md — 確立されたコードパターン、DBスキーマ]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-13 | Story creation — ultimate context engine | Story 2.2 context engine |
| 2026-03-13 | Implementation complete — all tasks done | Story 2.2 implementation |

### File List

- `src/app/stocks/page.tsx` — MODIFIED: Server Component + Suspense でデータ取得、Empty State 維持、StockTable 表示
- `src/app/stocks/layout.tsx` — MODIFIED: SidebarWithStocks Server Component で銘柄データ取得して AppSidebar に渡す
- `src/components/stocks/stock-table.tsx` — NEW: shadcn/ui Table ベースの銘柄一覧テーブル（tabular-nums、理論株価プレースホルダー）
- `src/components/layout/app-sidebar.tsx` — MODIFIED: stocks props 追加、銘柄リスト動的表示、理論株価サマリー用スペース確保
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: 2-2-stock-list-view ステータス更新
