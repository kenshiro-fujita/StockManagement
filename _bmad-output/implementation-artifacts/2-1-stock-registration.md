# Story 2.1: 銘柄新規登録

Status: done

## Story

As a ログイン済みユーザー,
I want 銘柄コード・企業名・市場・業種・事業セグメントを入力して銘柄を登録したい,
so that 分析対象の銘柄をウォッチリストに追加できる。（FR1）

## Acceptance Criteria

1. **AC1: 銘柄登録と保存**
   - Given ユーザーがログインしている
   - When 銘柄登録フォームで必要事項（銘柄コード、企業名、市場、業種）を入力して保存する
   - Then `stocks` テーブルに `user_id` 付きでレコードが作成される（RLSにより自分のデータのみアクセス可能）
   - And Toast通知で「銘柄を登録しました」と表示される

2. **AC2: 必須項目バリデーション**
   - Given 銘柄登録フォームが表示されている
   - When 必須項目（銘柄コード、企業名）を空のまま送信する
   - Then バリデーションエラーが表示される

3. **AC3: 銘柄コード重複チェック**
   - Given 銘柄登録フォームが表示されている
   - When 既に登録済みの銘柄コードを入力して送信する
   - Then 「この銘柄コードは既に登録されています」とエラーが表示される

4. **AC4: キーボード操作**
   - Given 銘柄登録フォームが表示されている
   - When キーボードのみで操作する
   - Then すべてのフォーム要素にフォーカスが移動でき、Tab/Enter で操作が完了できる

## Tasks / Subtasks

- [x] Task 1: Supabase マイグレーション — stocks テーブル作成 (AC: #1, #3)
  - [x] 1.1 `supabase init` でプロジェクト初期化（supabase/ ディレクトリ作成）
  - [x] 1.2 マイグレーションファイル作成: stocks テーブル + RLS ポリシー + UNIQUE制約 + インデックス
  - [ ] 1.3 Supabase ダッシュボードで SQL を実行（ローカル CLI ではなくリモートに直接適用）

- [x] Task 2: Zod バリデーションスキーマ (AC: #2)
  - [x] 2.1 `src/lib/schemas/stocks.ts` に `createStockSchema` を作成する
    - stock_code: 必須、1〜10文字
    - company_name: 必須、1〜100文字
    - market: オプション
    - sector: オプション
    - business_segment: オプション
  - [x] 2.2 スキーマのユニットテスト作成

- [x] Task 3: Server Action — 銘柄登録 (AC: #1, #3)
  - [x] 3.1 `src/actions/stocks.ts` に `createStock` Server Action を作成する
    - Zod バリデーション実行
    - Supabase クライアントで stocks テーブルに INSERT
    - 銘柄コード重複時のエラーハンドリング（unique_violation → 日本語エラーメッセージ）
    - 成功時 revalidatePath('/stocks')
    - 戻り値: `{ success: boolean; error?: string }`

- [x] Task 4: 銘柄登録フォーム UI (AC: #1, #2, #4)
  - [x] 4.1 `src/components/stocks/stock-form.tsx` を作成する
    - React Hook Form + Zod resolver（mode: 'onBlur'）
    - shadcn/ui Form コンポーネント使用（aria-describedby 自動設定）
    - フィールド: 銘柄コード、企業名、市場（Select）、業種（Select）、事業セグメント
    - 送信後 Toast 通知表示
  - [x] 4.2 `src/app/stocks/new/page.tsx` を作成する（銘柄登録ページ）
  - [x] 4.3 `/stocks` ページの Empty State に「銘柄を登録する」ボタンを追加する（/stocks/new へのリンク）

- [x] Task 5: テストとビルド確認 (AC: #1, #2, #3, #4)
  - [x] 5.1 Zod スキーマのユニットテスト実行確認
  - [x] 5.2 `npm run build` でビルド確認
  - [x] 5.3 Prettier/ESLint チェック

## Dev Notes

### DB スキーマ

```sql
CREATE TABLE stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  market TEXT,
  sector TEXT,
  business_segment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ユーザー内で銘柄コード一意
ALTER TABLE stocks ADD CONSTRAINT stocks_user_stock_code_unique UNIQUE (user_id, stock_code);

-- RLS
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own stocks" ON stocks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_stocks_user_id ON stocks (user_id);
```

### 確立されたコードパターン（Story 1.2-1.4）

- RHF + Zod: `mode: 'onBlur'`, `zodResolver`
- shadcn/ui Form: `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
- エラー日本語マッピング: `getJapaneseErrorMessage()` パターン
- インポート: `@` パスエイリアス
- ファイル命名: ケバブケース
- UI テキスト: すべて日本語

### Server Action パターン

```typescript
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createStock(data: CreateStockInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  const { error } = await supabase.from('stocks').insert({
    user_id: user.id,
    ...data,
  });

  if (error?.code === '23505') {
    return { success: false, error: 'この銘柄コードは既に登録されています' };
  }
  if (error) return { success: false, error: '銘柄の登録に失敗しました' };

  revalidatePath('/stocks');
  return { success: true };
}
```

### 市場・業種の選択肢

市場: 東証プライム、東証スタンダード、東証グロース、名証、札証、福証、その他
業種: 日本の33業種分類（水産・農林業、鉱業、建設業、食料品、...）

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.1 AC, FR1]
- [Source: _bmad-output/planning-artifacts/architecture.md — ワイドテーブル設計、RLS、Server Actions]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — onBlur バリデーション、Toast通知]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-13 | Story creation and implementation start | Story 2.1 context engine |
| 2026-03-13 | Code review fixes: Toaster position, .trim(), Select value handling | Code review H1, M2, L1 |

### File List

- `supabase/migrations/20260313133206_create_stocks_table.sql` — NEW: stocks テーブル DDL + RLS + UNIQUE制約 + インデックス
- `src/lib/schemas/stocks.ts` — NEW: createStockSchema (Zod) + MARKET_OPTIONS + SECTOR_OPTIONS
- `src/lib/schemas/stocks.test.ts` — NEW: createStockSchema ユニットテスト (9件)
- `src/actions/stocks.ts` — NEW: createStock Server Action
- `src/components/stocks/stock-form.tsx` — NEW: 銘柄登録フォーム (RHF + Zod + shadcn/ui)
- `src/app/stocks/new/page.tsx` — NEW: 銘柄登録ページ
- `src/app/stocks/page.tsx` — MODIFIED: Empty State に「銘柄を登録する」ボタン追加
- `src/app/layout.tsx` — MODIFIED: Toaster (sonner) 追加
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: epic-2, story 2-1 ステータス更新
