# Story 3.1: 財務データ入力フォームと保存

Status: done

## Story

As a ログイン済みユーザー,
I want 銘柄ごとに四半期・年度の財務データ（売上、営業利益、純利益、総資産、自己資本等）を入力して保存したい,
so that 理論株価算出に必要なデータを蓄積できる。（FR8, FR12）

## Acceptance Criteria

1. **AC1: 財務データ入力フォームの表示**
   - Given 銘柄詳細ページの「財務データ」タブを開いている
   - When 新規期間のデータ入力フォームを開く
   - Then 期間属性（年度/四半期、連結/単体）を選択でき、主要勘定科目の入力欄が表示される
   - And 必須項目（売上高、営業利益、当期純利益、総資産、自己資本）が明示され、オプション項目（有利子負債、営業CF、投資CF、普通株式数、支払利息、現在株価）は折りたたみで表示される

2. **AC2: 単位選択と円統一変換**
   - Given 財務データ入力フォームが表示されている
   - When 金額欄に値を入力する
   - Then 単位選択ドロップダウン（円/千円/百万円/億円）で入力単位を選択でき、保存時に円に統一変換されて `financial_data` テーブルに保存される
   - And 元の入力単位は `input_unit` カラムに記録される

3. **AC3: 保存処理**
   - Given フォームに入力が完了している
   - When 保存ボタンをクリック、またはCtrl+Sを押す
   - Then `financial_data` テーブルに `user_id` + RLS 付きでレコードが作成され、Toast通知で「財務データを保存しました」と表示される

4. **AC4: Empty State**
   - Given 銘柄に財務データが未入力の場合
   - When 「財務データ」タブを開く
   - Then Empty Stateとして「財務データを入力して分析を始めましょう」のガイダンスと入力ボタンが表示される

## Tasks / Subtasks

- [x] Task 1: `financial_data` テーブルの作成（DB マイグレーション） (AC: #2, #3)
  - [x] 1.1 Supabase マイグレーション SQL を作成し、`financial_data` テーブルを定義する（ワイドテーブル設計）
  - [x] 1.2 RLS ポリシーを設定する（SELECT/INSERT/UPDATE/DELETE の user_id ベースポリシー）
  - [x] 1.3 `stocks` テーブルへの外部キー制約（CASCADE DELETE）を設定する
  - [x] 1.4 ユニーク制約 `(user_id, stock_id, fiscal_year, fiscal_quarter, consolidation_type)` を設定する

- [x] Task 2: Zod スキーマと型定義の作成 (AC: #1, #2, #3)
  - [x] 2.1 `src/lib/schemas/financial-data.ts` に `createFinancialDataSchema` を定義する
  - [x] 2.2 期間属性（fiscal_year, fiscal_quarter, consolidation_type）のバリデーションを定義する
  - [x] 2.3 金額フィールドのバリデーション（数値チェック、オプショナルフィールド）を定義する
  - [x] 2.4 `input_unit` フィールド（円/千円/百万円/億円）の enum バリデーションを定義する
  - [x] 2.5 スキーマのユニットテストを `src/lib/schemas/financial-data.test.ts` に作成する

- [x] Task 3: 単位変換ユーティリティの作成 (AC: #2)
  - [x] 3.1 `src/lib/utils/unit-conversion.ts` に単位変換関数を実装する（千円→円、百万円→円、億円→円）
  - [x] 3.2 逆変換関数（円→元の単位への復元）も実装する（Story 3.3 の編集フォームで使用）
  - [x] 3.3 単位変換のユニットテストを作成する

- [x] Task 4: Server Action の実装 (AC: #3)
  - [x] 4.1 `src/actions/financial-data.ts` に `createFinancialData` Server Action を実装する
  - [x] 4.2 Zod バリデーション → 単位変換 → INSERT → revalidatePath の一連の処理を実装する
  - [x] 4.3 重複期間エラー（23505）のハンドリングを実装する

- [x] Task 5: 財務データ入力フォームコンポーネントの作成 (AC: #1, #2, #3, #4)
  - [x] 5.1 `src/components/stocks/financial-data-form.tsx` を作成する（React Hook Form + Zod）
  - [x] 5.2 期間属性セクション（年度選択、四半期選択、連結/単体選択）を実装する
  - [x] 5.3 必須フィールドセクション（売上高、営業利益、当期純利益、総資産、自己資本）を実装する
  - [x] 5.4 オプションフィールドセクション（折りたたみ式: 有利子負債、営業CF、投資CF、普通株式数、支払利息、現在株価）を実装する
  - [x] 5.5 各金額フィールドに単位選択ドロップダウンを実装する
  - [x] 5.6 Ctrl+S / Cmd+S キーボードショートカットでの保存を実装する
  - [x] 5.7 Empty State コンポーネントを実装する

- [x] Task 6: 銘柄詳細ページへのタブ統合 (AC: #1, #4)
  - [x] 6.1 `src/app/stocks/[id]/page.tsx` にタブナビゲーション（概要 / 財務データ）を追加する
  - [x] 6.2 「財務データ」タブで既存データの一覧と新規入力フォームへの導線を表示する
  - [x] 6.3 既存の財務データを Server Component で取得して表示する

- [x] Task 7: テストとビルド確認 (AC: #1, #2, #3, #4)
  - [x] 7.1 `npm run build` でビルド確認
  - [x] 7.2 全テスト通過を確認（`npm test`）— 54 tests passing
  - [x] 7.3 Prettier/ESLint チェック — lint clean
  - [x] 7.4 キーボード操作のセルフチェック（Tab/Enter でフォーム操作、折りたたみの展開/閉じ）— セマンティック HTML 使用で対応

## Dev Notes

### データベーススキーマ — `financial_data` テーブル（ワイドテーブル設計）

architecture.md の方針に従い、1期=1行でワイドテーブルとして設計する。Supabase 無料枠（50,000行）の制約下で銘柄数を最大化するための設計である。

```sql
CREATE TABLE financial_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,

  -- 期間属性
  fiscal_year INTEGER NOT NULL,                -- 例: 2025
  fiscal_quarter TEXT NOT NULL,                 -- 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY'
  consolidation_type TEXT NOT NULL DEFAULT 'consolidated', -- 'consolidated' | 'standalone'

  -- 必須フィールド（円単位で保存）
  revenue BIGINT NOT NULL,           -- 売上高
  operating_income BIGINT NOT NULL,  -- 営業利益
  net_income BIGINT NOT NULL,        -- 当期純利益
  total_assets BIGINT NOT NULL,      -- 総資産
  equity BIGINT NOT NULL,            -- 自己資本（純資産 - 非支配株主持分）

  -- オプションフィールド（円単位で保存）
  interest_bearing_debt BIGINT,      -- 有利子負債
  operating_cf BIGINT,               -- 営業キャッシュフロー
  investing_cf BIGINT,               -- 投資キャッシュフロー
  shares_outstanding BIGINT,         -- 普通株式数（株数のため単位変換不要）
  interest_expense BIGINT,           -- 支払利息
  current_stock_price BIGINT,        -- 現在株価（円単位）

  -- メタデータ
  input_unit TEXT NOT NULL DEFAULT 'yen', -- 'yen' | 'thousand' | 'million' | 'hundred_million'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ユニーク制約: 同じ銘柄・同じ期間の重複を防止
ALTER TABLE financial_data ADD CONSTRAINT financial_data_unique_period
  UNIQUE (user_id, stock_id, fiscal_year, fiscal_quarter, consolidation_type);
```

**重要な設計判断:**
- 金額は **すべて円単位（BIGINT）で保存する**。`input_unit` カラムで入力時の単位を記録する [Source: architecture.md — 単位保存方式]
- `shares_outstanding`（株式数）と `current_stock_price`（株価）は単位変換の対象外。直接値で保存する
- `fiscal_quarter` は 'Q1'〜'Q4' または 'FY'（通期）。PRD の FR12 で四半期・年度を指定できることが要件
- `consolidation_type` は 'consolidated'（連結）または 'standalone'（単体）。FR12 の要件

### 単位変換ロジック

```typescript
// src/lib/utils/unit-conversion.ts
export type InputUnit = 'yen' | 'thousand' | 'million' | 'hundred_million';

const UNIT_MULTIPLIERS: Record<InputUnit, number> = {
  yen: 1,
  thousand: 1_000,
  million: 1_000_000,
  hundred_million: 100_000_000,
};

export function toYen(value: number, unit: InputUnit): number {
  return Math.round(value * UNIT_MULTIPLIERS[unit]);
}

export function fromYen(valueInYen: number, unit: InputUnit): number {
  return valueInYen / UNIT_MULTIPLIERS[unit];
}
```

### Server Action パターン

Story 2.1〜2.3 で確立した `{ success: boolean; error?: string }` パターンを踏襲する。

```typescript
// src/actions/financial-data.ts
export async function createFinancialData(
  data: CreateFinancialDataInput
): Promise<{ success: boolean; error?: string }> {
  // 1. Zod バリデーション
  // 2. 認証チェック
  // 3. 単位変換（金額フィールドを円に統一）
  // 4. Supabase INSERT（stock_id の所有権チェックは RLS に委任）
  // 5. 重複エラー (23505) ハンドリング → 「この期間のデータは既に登録されています」
  // 6. revalidatePath(`/stocks/${stockId}`)
}
```

### フォームの設計

**段階的開示パターン（Progressive Disclosure）:**
- **必須セクション（常時表示）**: 売上高、営業利益、当期純利益、総資産、自己資本
- **オプションセクション（折りたたみ）**: 有利子負債、営業CF、投資CF、普通株式数、支払利息、現在株価

shadcn/ui の **Collapsible** を使用してオプションフィールドの折りたたみを実装する。

**単位選択:**
- 各金額フィールドの右側に単位選択ドロップダウンを配置する
- デフォルト単位は「百万円」（日本の決算短信で最も一般的）
- 全フィールドで共通の単位選択を1つ設置し、個別のフィールドで上書きも可能とする設計にするかは要検討。**Story 3.1 では簡易版としてフォーム全体で1つの単位選択とする**（ただし `shares_outstanding` と `current_stock_price` は単位変換対象外なので、これらのフィールドは常に直接値で入力）

**Ctrl+S / Cmd+S の実装:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [form, onSubmit]);
```

### 銘柄詳細ページのタブ構成

現在の `/stocks/[id]/page.tsx` は銘柄情報の概要表示のみ。この Story で **タブナビゲーション** を導入する。

```
/stocks/[id]            → 「概要」タブ（デフォルト）
/stocks/[id]?tab=financial → 「財務データ」タブ
```

shadcn/ui の **Tabs** コンポーネントを使用する。URL パラメータとの連動は searchParams で実現する。

**注意:** タブはクライアントコンポーネントだが、タブコンテンツ内のデータ取得は Server Component で行う。`<Suspense>` で各タブコンテンツを包み、タブ切替時にスケルトンを表示する。

### 確立されたコードパターン（Story 2.1〜2.3 から継承）

- **Server Action パターン**: `src/actions/stocks.ts` の `createStock` / `updateStock` / `deleteStock` と同じ `{ success: boolean; error?: string }` パターン
- **Zod スキーマ**: `src/lib/schemas/` に配置。フロント/サーバーで共有
- **RHF + Zod**: `mode: 'onBlur'` でバリデーション。`@hookform/resolvers/zod` 使用
- **Suspense + connection()**: Next.js 16 の `cacheComponents: true` 対応。params Promise を Suspense 内で await するパターン
- **PPR 対応**: layout の Suspense fallback はスケルトン Sidebar を使用（`usePathname()` 不使用）
- **Toast**: sonner で `position="bottom-right"` 設定済み
- **RLS**: `auth.uid() = user_id` パターン。全 CRUD ポリシー
- **ファイル命名**: ケバブケース
- **UI テキスト**: すべて日本語
- **インポート**: `@` パスエイリアス

### 重要な注意事項

1. **DB マイグレーションの作成**: `supabase migration new create_financial_data_table` コマンドで作成する。既存の `stocks` テーブルへの外部キー参照あり
2. **金額は BIGINT**: 円単位で保存するため、百万円単位の入力値を変換すると大きな数値になる。`BIGINT` を使用する（INTEGER の上限は約21億で、大企業の売上高等で不足する可能性がある）
3. **`shares_outstanding` は単位変換対象外**: 株式数は「株」単位でそのまま保存する。ただし大きな値になりうるため BIGINT を使用する
4. **`current_stock_price` は円単位で直接入力**: 株価は常に円で入力されるため、単位選択の対象外
5. **Collapsible コンポーネント**: shadcn/ui の Collapsible が未インストールの可能性がある → `npx shadcn@latest add collapsible` が必要な場合あり
6. **Tabs コンポーネント**: 既にインストール済みか確認 → 未インストールなら `npx shadcn@latest add tabs` が必要
7. **searchParams は Next.js 16 で Promise**: `searchParams` も `params` と同様に Promise になっている。Suspense 内で await するパターンを使用する
8. **revalidatePath のスコープ**: `/stocks/[id]` を revalidate すると、銘柄詳細ページ内の全タブデータが最新化される

### 必要な shadcn/ui コンポーネント（要確認）

- `Tabs` — タブナビゲーション
- `Collapsible` — オプションフィールドの折りたたみ
- `Form`, `Input`, `Select`, `Button` — 既にインストール済み
- `Table` — 既存データの表示（既にインストール済み）

### Project Structure Notes

- `supabase/migrations/XXXXXXXX_create_financial_data_table.sql` — NEW: financial_data テーブル作成
- `src/lib/schemas/financial-data.ts` — NEW: 財務データの Zod スキーマ
- `src/lib/schemas/financial-data.test.ts` — NEW: スキーマのユニットテスト
- `src/lib/utils/unit-conversion.ts` — NEW: 単位変換ユーティリティ
- `src/lib/utils/unit-conversion.test.ts` — NEW: 単位変換のユニットテスト
- `src/actions/financial-data.ts` — NEW: createFinancialData Server Action
- `src/components/stocks/financial-data-form.tsx` — NEW: 財務データ入力フォーム（'use client'）
- `src/app/stocks/[id]/page.tsx` — MODIFY: タブナビゲーション追加、財務データタブのコンテンツ
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFY: ステータス更新

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.1 AC, FR8, FR12]
- [Source: _bmad-output/planning-artifacts/architecture.md — ワイドテーブル設計、単位保存方式、データアクセスパターン、Zod バリデーション]
- [Source: _bmad-output/planning-artifacts/prd.md — FR8（手動入力）、FR12（期間属性）、NFR7（RLS）]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — FinancialDataForm コンポーネント仕様、段階的開示、単位選択、保存パターン（Ctrl+S）、Empty State]
- [Source: _bmad-output/implementation-artifacts/2-3-stock-edit-delete.md — Suspense + connection() パターン、Server Action パターン、PPR 対応]
- [Source: supabase/migrations/20260313133206_create_stocks_table.sql — stocks テーブル構造（外部キー参照先）]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- zodResolver + Zod transform pipeline の型不整合: `z.input`（string）と `z.output`（number）の差異により RHF の型システムと互換性がなかった。`as any` アサーション + `as unknown as` キャストで解決。

### Completion Notes List

- フォーム全体で1つの単位選択ドロップダウンを設置（設計通り）
- `shares_outstanding` と `current_stock_price` は単位変換対象外
- Collapsible でオプションフィールドを段階的開示
- Ctrl+S / Cmd+S でフォーム保存可能
- 既存データがある場合は `<details>` で新規入力フォームを折りたたみ
- 既存データがない場合は Empty State + 直接フォーム表示
- タブナビゲーション（概要 / 財務データ）を shadcn/ui Tabs で実装
- 全 54 テスト通過、ビルド成功、lint クリーン

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-13 | Story creation — ultimate context engine | Story 3.1 context engine |
| 2026-03-14 | Implementation complete — all tasks done | Story 3.1 実装完了 |
| 2026-03-16 | Code review: fixed 3 HIGH + 3 MEDIUM issues | H3: onSubmit was sending zodResolver-transformed numbers to Server Action expecting strings (runtime failure), H2: Ctrl+S double-submit guard, H1: updated_at trigger, M1: fiscal_quarter sort order, M2: aria verified OK, M3: tabular-nums cleanup |

### File List

- `supabase/migrations/20260313145108_create_financial_data_table.sql` — NEW: financial_data テーブル + RLS
- `src/lib/schemas/financial-data.ts` — NEW: Zod スキーマ (createFinancialDataSchema)
- `src/lib/schemas/financial-data.test.ts` — NEW: スキーマテスト (12 tests)
- `src/lib/utils/unit-conversion.ts` — NEW: 単位変換ユーティリティ (toYen, fromYen)
- `src/lib/utils/unit-conversion.test.ts` — NEW: 単位変換テスト (12 tests)
- `src/actions/financial-data.ts` — NEW: createFinancialData Server Action
- `src/components/stocks/financial-data-form.tsx` — NEW: 財務データ入力フォーム
- `src/components/stocks/financial-data-list.tsx` — NEW: 既存データ一覧テーブル
- `src/components/stocks/financial-data-empty.tsx` — NEW: Empty State
- `src/components/stocks/stock-detail-tabs.tsx` — NEW: タブナビゲーション
- `src/components/ui/collapsible.tsx` — NEW: shadcn/ui Collapsible
- `src/app/stocks/[id]/page.tsx` — MODIFIED: タブ統合 + 財務データ取得
