# Story 2.3: 銘柄編集・削除

Status: done

## Story

As a ログイン済みユーザー,
I want 登録済み銘柄の情報を編集したり、不要な銘柄を削除したい,
so that ウォッチリストを常に最新の状態に保てる。（FR2）

## Acceptance Criteria

1. **AC1: 編集フォームのプリフィル**
   - Given 銘柄一覧に登録済み銘柄が表示されている
   - When 銘柄を選択して編集フォームを開く
   - Then 現在の登録情報（銘柄コード、企業名、市場、業種、事業セグメント）がフォームにプリフィルされる

2. **AC2: 編集の保存**
   - Given 編集フォームで情報を変更する
   - When 保存する
   - Then `stocks` テーブルが更新され、Toast通知で「銘柄情報を更新しました」と表示される
   - And 銘柄一覧とサイドバーに変更が即座に反映される

3. **AC3: 削除の確認ダイアログ**
   - Given 銘柄を削除しようとする
   - When 削除ボタンをクリックする
   - Then 「この銘柄を削除しますか？関連する財務データも削除されます」の確認ダイアログが表示される

4. **AC4: 削除の実行**
   - Given 確認ダイアログで「削除」を選択する
   - When 削除が実行される
   - Then 銘柄とその関連データが削除され、銘柄一覧から消える
   - And Toast通知で「銘柄を削除しました」と表示される

## Tasks / Subtasks

- [x] Task 1: 銘柄詳細ページの作成 (AC: #1)
  - [x] 1.1 `src/app/stocks/[id]/page.tsx` を Server Component として作成し、Supabase から該当銘柄を取得する
  - [x] 1.2 銘柄が見つからない場合は `notFound()` を呼び出す
  - [x] 1.3 取得した銘柄データを `StockForm` に渡して編集フォームを表示する

- [x] Task 2: Zod スキーマと Server Actions の拡張 (AC: #2, #4)
  - [x] 2.1 `src/lib/schemas/stocks.ts` に `updateStockSchema` を追加する（createStockSchema を拡張し `id` フィールドを追加）
  - [x] 2.2 `src/actions/stocks.ts` に `updateStock` Server Action を追加する（Zod バリデーション → UPDATE → revalidatePath）
  - [x] 2.3 `src/actions/stocks.ts` に `deleteStock` Server Action を追加する（id 検証 → DELETE → revalidatePath → redirect）
  - [x] 2.4 `updateStockSchema` のユニットテストを `src/lib/schemas/stocks.test.ts` に追加する

- [x] Task 3: StockForm の編集モード対応 (AC: #1, #2)
  - [x] 3.1 `src/components/stocks/stock-form.tsx` に `stock` optional prop を追加し、渡された場合は編集モードとして動作する
  - [x] 3.2 編集モード時はフォームに既存データをプリフィルし、ボタンラベルを「更新する」に変更する
  - [x] 3.3 編集モード時のフォーム送信で `updateStock` を呼び出す
  - [x] 3.4 キャンセルボタンの遷移先を編集モードでは `/stocks/[id]` に変更する

- [x] Task 4: 削除機能の実装 (AC: #3, #4)
  - [x] 4.1 `src/components/stocks/stock-delete-button.tsx` を作成する（shadcn/ui AlertDialog 使用）
  - [x] 4.2 確認ダイアログに「この銘柄を削除しますか？関連する財務データも削除されます」メッセージを表示する
  - [x] 4.3 「削除」確定で `deleteStock` Server Action を呼び出し、成功時に `/stocks` へリダイレクトする

- [x] Task 5: テストとビルド確認 (AC: #1, #2, #3, #4)
  - [x] 5.1 `npm run build` でビルド確認
  - [x] 5.2 Prettier/ESLint チェック
  - [x] 5.3 キーボード操作のセルフチェック（Tab/Enter でフォーム操作、ダイアログの Escape キー動作）

## Dev Notes

### データ取得パターン

architecture.md の方針に従い、**読み取りは Server Components 内で直接 Supabase クライアントを呼び出す**パターンを使用する。

```typescript
// src/app/stocks/[id]/page.tsx — Server Component パターン
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';

async function StockDetail({ id }: { id: string }) {
  await connection();
  const supabase = await createClient();
  const { data: stock } = await supabase
    .from('stocks')
    .select('id, stock_code, company_name, market, sector, business_segment')
    .eq('id', id)
    .single();

  if (!stock) notFound();

  return <StockForm stock={stock} />;
}
```

### Server Actions パターン

Story 2.1 で確立した `createStock` と同じパターンで `updateStock` / `deleteStock` を実装する。

```typescript
// src/actions/stocks.ts — 追加分

// updateStock: { success: boolean; error?: string } を返す
// - Zod で入力バリデーション
// - supabase.from('stocks').update({...}).eq('id', id)
// - 重複キーエラー (23505) のハンドリング
// - revalidatePath('/stocks')

// deleteStock: { success: boolean; error?: string } を返す
// - id の UUID 形式チェック
// - supabase.from('stocks').delete().eq('id', id)
// - revalidatePath('/stocks')
// - 成功時はクライアント側で redirect('/stocks')
```

### StockForm の編集モード設計

既存の `stock-form.tsx` を **新規/編集の両モードで使い回す**。新しいコンポーネントは作らない。

```typescript
// stock props の有無でモードを切り替え
type StockFormProps = {
  stock?: {
    id: string;
    stock_code: string;
    company_name: string;
    market: string | null;
    sector: string | null;
    business_segment: string | null;
  };
};

// stock あり → 編集モード
// - defaultValues に stock データをセット
// - 送信先: updateStock(stock.id, data)
// - ボタン: 「更新する」
// - キャンセル先: /stocks/${stock.id}

// stock なし → 新規モード（現行動作を維持）
```

### 削除の確認ダイアログ

shadcn/ui の **AlertDialog** を使用する（`src/components/ui/dialog.tsx` は既にインストール済みだが、AlertDialog は未インストールの可能性がある → `npx shadcn@latest add alert-dialog` が必要な場合あり）。

```typescript
// src/components/stocks/stock-delete-button.tsx
// - AlertDialogTrigger: 「削除」ボタン（variant="destructive"）
// - AlertDialogContent: 確認メッセージ + キャンセル/削除ボタン
// - 削除実行時: deleteStock(stockId) → toast → redirect('/stocks')
```

### 確立されたコードパターン（Story 2.1, 2.2 から継承）

- **Server Action パターン**: `src/actions/stocks.ts` に `createStock` が既に実装済み。`revalidatePath('/stocks')` による再取得
- **Zod スキーマ**: `src/lib/schemas/stocks.ts` に `createStockSchema`, `MARKET_OPTIONS`, `SECTOR_OPTIONS` が定義済み。`.trim()` でホワイトスペース処理済み
- **RHF + Zod**: `mode: 'onBlur'` でバリデーション。`@hookform/resolvers/zod` 使用
- **DB スキーマ**: `stocks` テーブル（id, user_id, stock_code, company_name, market, sector, business_segment, created_at, updated_at）
- **RLS**: `auth.uid() = user_id` パターン — UPDATE / DELETE ポリシーも既に作成済み（Story 2.1 のマイグレーションで全 CRUD ポリシーを設定済み）
- **UNIQUE 制約**: `(user_id, stock_code)` — 編集時の重複チェックでも考慮が必要（自分自身の stock_code は許可する）
- **shadcn/ui**: Form, Select, Table, Button, Dialog 等が既にインストール済み
- **Toast**: sonner で `position="bottom-right"` 設定済み（`src/app/layout.tsx`）
- **ファイル命名**: ケバブケース
- **UI テキスト**: すべて日本語
- **インポート**: `@` パスエイリアス
- **Suspense + connection()**: Next.js 16 の `cacheComponents: true` 対応パターン。`await connection()` + `<Suspense>` で動的レンダリング

### 重要な注意事項

1. **`[id]` ディレクトリは .gitkeep のみ** — `src/app/stocks/[id]/` は存在するが空。`page.tsx` を新規作成する
2. **StockForm は 'use client'** — Server Component から stock データを props で渡す。Story 2.2 のサイドバーと同じパターン
3. **update 時の重複チェック**: PostgreSQL の UNIQUE 制約 `(user_id, stock_code)` が UPDATE でもエラーを返す可能性がある。createStock と同様に 23505 エラーをハンドリングする。ただし「自分自身の stock_code を変更しない場合」はエラーにならない（同じレコードの更新は制約に抵触しない）
4. **CASCADE DELETE**: `stocks.user_id` は `ON DELETE CASCADE` だが、stocks 自体の削除では関連する `financial_data` テーブル（Epic 3 で作成予定）がまだ存在しない。現時点では stocks テーブルの行削除のみで完結する。ただし確認ダイアログのメッセージは将来の関連データ削除を見据えた文言にする
5. **redirect の使い方**: Server Actions 内で `redirect()` を使うと `NEXT_REDIRECT` エラーが throw される。deleteStock は `{ success: true }` を返し、**クライアント側で** `router.push('/stocks')` する
6. **revalidatePath のスコープ**: `/stocks` を revalidate すると、銘柄一覧ページ + layout（サイドバー）の両方が最新化される

### Project Structure Notes

- `src/app/stocks/[id]/page.tsx` — NEW: 銘柄詳細/編集ページ（Server Component → StockForm に stock を渡す）
- `src/components/stocks/stock-form.tsx` — MODIFY: stock optional prop 追加、編集/新規モード分岐
- `src/components/stocks/stock-delete-button.tsx` — NEW: 削除確認ダイアログコンポーネント
- `src/actions/stocks.ts` — MODIFY: updateStock, deleteStock Server Actions 追加
- `src/lib/schemas/stocks.ts` — MODIFY: updateStockSchema 追加
- `src/lib/schemas/stocks.test.ts` — MODIFY: updateStockSchema のテスト追加

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.3 AC, FR2]
- [Source: _bmad-output/planning-artifacts/architecture.md — データアクセスパターン（Server Actions）、エラーハンドリング]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — 確認ダイアログ、Toast、フォームバリデーション]
- [Source: _bmad-output/implementation-artifacts/2-1-stock-registration.md — Server Action パターン、Zod スキーマ、RHF]
- [Source: _bmad-output/implementation-artifacts/2-2-stock-list-view.md — Suspense + connection() パターン、サイドバー連動]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- ビルドエラー対応: Next.js 16 `cacheComponents: true` で動的ルート `/stocks/[id]` のプリレンダリング時に `usePathname()` が Suspense fallback 内で「uncached data」として扱われた。layout の Suspense fallback を `<AppSidebar />` からスケルトン Sidebar に変更して解決
- ビルドエラー対応: `await params` を Suspense 外で実行するとページ全体が動的になる問題。params Promise を Suspense 内のコンポーネントに渡して中で await するパターンに変更
- Zod v4 対応: `z.string().uuid()` は非推奨。`z.uuid()` を使用

### Completion Notes List

- updateStockSchema: createStockSchema を `.extend()` で拡張し、`z.uuid()` の id フィールドを追加（5テスト追加、計14テスト）
- updateStock Server Action: Zod バリデーション → UPDATE → 23505 ハンドリング → revalidatePath
- deleteStock Server Action: id チェック → DELETE → revalidatePath（クライアント側で redirect）
- StockForm 編集モード: stock prop の有無で新規/編集モードを切り替え。defaultValues プリフィル、ボタンラベル、トースト、キャンセル先を分岐
- StockDeleteButton: AlertDialog でユーザー確認 → deleteStock → toast → router.push
- 銘柄詳細ページ: stock_code + company_name のヘッダー、dl/dt/dd で情報表示、編集/削除ボタン
- 銘柄編集ページ: /stocks/[id]/edit に StockForm(stock) を配置
- layout fallback 修正: usePathname を使わないスケルトン Sidebar に変更（PPR 対応）

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-13 | Story creation — ultimate context engine | Story 2.3 context engine |
| 2026-03-13 | Implementation complete — all tasks done | Story 2.3 implementation |

### File List

- `src/app/stocks/[id]/page.tsx` — NEW: 銘柄詳細ページ（Server Component、Suspense、notFound、編集/削除ボタン）
- `src/app/stocks/[id]/edit/page.tsx` — NEW: 銘柄編集ページ（Server Component → StockForm(stock)）
- `src/components/stocks/stock-form.tsx` — MODIFIED: stock optional prop 追加、編集/新規モード分岐
- `src/components/stocks/stock-delete-button.tsx` — NEW: AlertDialog ベースの削除確認コンポーネント
- `src/actions/stocks.ts` — MODIFIED: updateStock, deleteStock Server Actions 追加
- `src/lib/schemas/stocks.ts` — MODIFIED: updateStockSchema, UpdateStockInput 追加
- `src/lib/schemas/stocks.test.ts` — MODIFIED: updateStockSchema のテスト5件追加（計14件）
- `src/components/ui/alert-dialog.tsx` — NEW: shadcn/ui AlertDialog コンポーネント（npx shadcn add）
- `src/app/stocks/layout.tsx` — MODIFIED: Suspense fallback をスケルトン Sidebar に変更（PPR 対応）
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: 2-3-stock-edit-delete ステータス更新
