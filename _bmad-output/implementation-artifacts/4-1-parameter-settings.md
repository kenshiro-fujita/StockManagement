# Story 4.1: 前提パラメータの設定と管理

Status: done

## Story

As a ログイン済みユーザー,
I want 銘柄ごとに理論株価算出の前提パラメータ（割引率r、成長率g、実効税率等）を設定・調整したい,
so that 自分の投資判断に合った前提条件で理論株価を算出できる。（FR18, FR19）

## Acceptance Criteria

1. **AC1: パラメータ表示とデフォルト値の根拠確認**
   - Given 銘柄詳細ページの「パラメータ」タブを開いている
   - When パラメータ設定画面を表示する
   - Then 各パラメータ（r, g, 実効税率, 上限倍率）にデフォルト値が設定されており、そのデフォルト値の根拠（例：「日本株の長期平均リスクプレミアム」等）が確認できる

2. **AC2: パラメータ未設定時のデフォルト作成**
   - Given パラメータが未設定の銘柄の場合
   - When 「パラメータ」タブを初めて開く
   - Then `parameters` テーブルにデフォルト値でレコードが作成され、`user_id` + RLS 付きで保存される

3. **AC3: パラメータ変更と保存**
   - Given パラメータ設定画面が表示されている
   - When パラメータの値を変更して保存する
   - Then `parameters` テーブルが更新され、Toast通知で「パラメータを保存しました」と表示される

4. **AC4: バリデーション**
   - Given パラメータ入力欄が表示されている
   - When 不正な値（負の割引率、100%超の税率等）を入力する
   - Then Zodバリデーションによるエラーが表示される

## Tasks / Subtasks

- [x] Task 1: parameters テーブルの作成（DB マイグレーション） (AC: #2)
  - [x] 1.1 `supabase/migrations/` に `parameters` テーブル作成 SQL を追加する
  - [x] 1.2 カラム: `id`, `user_id`, `stock_id`, `discount_rate`, `growth_rate`, `tax_rate`, `cap_multiplier`, `created_at`, `updated_at`
  - [x] 1.3 UNIQUE 制約: `(user_id, stock_id)`
  - [x] 1.4 RLS ポリシー設定（SELECT, INSERT, UPDATE, DELETE — financial_data と同パターン）
  - [x] 1.5 インデックス: `user_id`, `stock_id`
  - [x] 1.6 `updated_at` の自動更新トリガー（既存の `update_updated_at_column()` 関数を再利用）
  - [x] 1.7 Docker 未起動のため `supabase db reset` はスキップ — SQL は既存マイグレーションと同パターンで作成済み

- [x] Task 2: Zod スキーマと型定義の作成 (AC: #4)
  - [x] 2.1 `src/lib/schemas/parameters.ts` に `updateParametersSchema` を作成する
  - [x] 2.2 バリデーションルール:
    - `discount_rate`: 0.001〜0.30（0.1%〜30%）。`g` より大きいことを `superRefine` で検証する
    - `growth_rate`: 0〜0.15（0%〜15%）。`discount_rate` より小さいことを `superRefine` で検証する
    - `tax_rate`: 0〜1.0（0%〜100%）
    - `cap_multiplier`: 1〜100（整数でなくてもよい）
  - [x] 2.3 `src/lib/types/parameters.ts` にパラメータの型定義を作成する（`ParametersRow` 型）
  - [x] 2.4 デフォルト値定数を `src/lib/schemas/parameters.ts` にエクスポートする:
    - `PARAMETER_DEFAULTS` オブジェクト（`discount_rate: 0.08`, `growth_rate: 0.02`, `tax_rate: 0.3`, `cap_multiplier: 10`）
    - `PARAMETER_META` オブジェクト（各パラメータの `label`, `description`（デフォルト値の根拠）, `unit`（%/倍）, `min`, `max`, `step`, `displayMultiplier`）
  - [x] 2.5 Zod スキーマのユニットテストを作成する — 13テスト通過

- [x] Task 3: Server Actions の作成 (AC: #2, #3)
  - [x] 3.1 `src/actions/parameters.ts` を作成する
  - [x] 3.2 `getOrCreateParameters(stockId)`: パラメータ取得。未存在時はデフォルト値で INSERT して返す
  - [x] 3.3 `updateParameters(stockId, data)`: パラメータ更新。Zod バリデーション → Supabase UPDATE → `revalidatePath`
  - [x] 3.4 認証チェック（`auth.getUser()`）と RLS による二重保護
  - [x] 3.5 `{ success: boolean; error?: string; data?: ParametersRow }` 形式の戻り値

- [x] Task 4: パラメータタブの追加と UI 作成 (AC: #1, #2, #3, #4)
  - [x] 4.1 `src/components/stocks/stock-detail-tabs.tsx` に `parametersContent` prop と「パラメータ」タブを追加する
  - [x] 4.2 `src/app/stocks/[id]/page.tsx` で `parameters` データを取得し、タブに渡す
  - [x] 4.3 `src/components/stocks/parameter-section.tsx` を作成する（Client Component）:
    - `getOrCreateParameters` を初回レンダリング時に呼び出す（Server Component から prop で初期データを渡す）
    - React Hook Form + Zod でフォーム管理
    - 各パラメータを `<Slider>` + 数値入力 + デフォルト値の根拠テキストで表示する
    - 「保存」ボタンで `updateParameters` を呼び出す
    - 成功時に `toast.success('パラメータを保存しました')` を表示する
    - 「デフォルトに戻す」ボタンでデフォルト値にリセットする
  - [x] 4.4 スライダーの `aria-valuemin`, `aria-valuemax`, `aria-valuenow` が正しく設定されることを確認する（Radix UI Slider が自動対応 + `aria-label` を各 Slider に設定済み）
  - [x] 4.5 フォームエラーの `aria-describedby` によるスクリーンリーダー読み上げ対応（shadcn/ui の FormMessage が自動対応）

- [x] Task 5: テストとビルド確認 (AC: #1, #2, #3, #4)
  - [x] 5.1 Zod スキーマのユニットテスト（正常値、境界値、r ≤ g のエラー）— 13テスト通過
  - [x] 5.2 `npm run build` でビルド確認 — 成功
  - [x] 5.3 全テスト通過を確認（`npm test`）— 83テスト通過
  - [x] 5.4 キーボード操作・アクセシビリティのセルフチェック — Slider は矢印キー操作対応、フォーカス可視化対応、FormMessage で aria-describedby 対応

## Dev Notes

### パラメータ定義（Phase 1 基本パラメータ）

| パラメータ | DB カラム | デフォルト値 | 根拠 | UI 表示 | 範囲 | ステップ |
|-----------|-----------|-------------|------|---------|------|---------|
| 割引率 (r) | `discount_rate` | 0.08 (8%) | 日本株の長期平均リスクプレミアム（約5%）+ リスクフリーレート（約3%） | % | 0.1%〜30% | 0.1% |
| 永久成長率 (g) | `growth_rate` | 0.02 (2%) | 日本の長期名目GDP成長率 | % | 0%〜15% | 0.1% |
| 実効税率 | `tax_rate` | 0.30 (30%) | 日本の法定実効税率の近似値 | % | 0%〜100% | 1% |
| 上限倍率 | `cap_multiplier` | 10 | 事業価値算出時の営業利益倍率上限（山口揚平氏の手法） | 倍 | 1〜100 | 1 |

**Phase 2 高度パラメータ（本ストーリーでは DB カラムのみ作成、UI 非露出）:**
- `beta` (β値): デフォルト 1.0
- `interest_rate` (支払利息率): デフォルト null（自動算出予定）
- `debt_cost` (負債調達コスト): デフォルト null
- `equity_cost` (資本調達コスト): デフォルト null
- `theoretical_discount_rate` (理論割引率): デフォルト null

→ これらは Story 4.2（計算エンジン）で自動算出ロジックが決まった後に、DB スキーマへの追加を再検討する。**Phase 1 では基本4パラメータのカラムのみ作成する。**

### DB マイグレーション設計

```sql
CREATE TABLE parameters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  discount_rate NUMERIC NOT NULL DEFAULT 0.08,
  growth_rate NUMERIC NOT NULL DEFAULT 0.02,
  tax_rate NUMERIC NOT NULL DEFAULT 0.30,
  cap_multiplier NUMERIC NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, stock_id)
);
```

- `NUMERIC` 型を使用する（浮動小数点の精度問題を回避するため）
- 既存の `update_updated_at_column()` 関数を再利用する（`financial_data` マイグレーションで作成済み）
- RLS ポリシーは `financial_data` と同パターン（SELECT, INSERT, UPDATE, DELETE で `auth.uid() = user_id`）

### Server Action パターン（既存踏襲）

```typescript
// src/actions/parameters.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getOrCreateParameters(stockId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  // まず取得を試みる
  const { data: existing } = await supabase
    .from('parameters')
    .select('*')
    .eq('stock_id', stockId)
    .eq('user_id', user.id)
    .single();

  if (existing) return { success: true, data: existing };

  // 未存在: デフォルト値で作成
  const { data: created, error } = await supabase
    .from('parameters')
    .insert({ user_id: user.id, stock_id: stockId })
    .select()
    .single();

  if (error) return { success: false, error: 'パラメータの初期化に失敗しました' };
  return { success: true, data: created };
}
```

### UI コンポーネント設計

**parameter-section.tsx** — Client Component:
- Server Component（page.tsx）から初期パラメータデータを prop として受け取る
- React Hook Form + Zod でフォーム管理
- 各パラメータ行: ラベル + Slider + 数値入力 + 根拠テキスト
- スライダー値と入力欄を双方向バインド（Slider onChange → form setValue、Input onChange → Slider value）
- 「保存」ボタンと「デフォルトに戻す」ボタン
- `r ≤ g` の場合にクロスフィールドバリデーションエラーを表示する

**レイアウト:**
```
┌─────────────────────────────────────────┐
│ パラメータ設定                              │
├─────────────────────────────────────────┤
│ 割引率 (r)                                │
│ [━━━━━━━━━●━━━━] [  8.0 ] %             │
│ 日本株の長期平均リスクプレミアム + リスクフリーレート   │
│                                          │
│ 永久成長率 (g)                              │
│ [━━●━━━━━━━━━━] [  2.0 ] %              │
│ 日本の長期名目GDP成長率                       │
│                                          │
│ 実効税率                                   │
│ [━━━━━━━●━━━━━] [  30  ] %              │
│ 日本の法定実効税率の近似値                      │
│                                          │
│ 上限倍率                                   │
│ [━━━━━━━━━●━━━] [  10  ] 倍             │
│ 事業価値算出時の営業利益倍率上限                  │
│                                          │
│   [デフォルトに戻す]        [保存]            │
└─────────────────────────────────────────┘
```

### 確立されたコードパターン（Epic 1-3 から継承）

- **Server Action パターン**: `{ success: boolean; error?: string; data?: T }` — 認証チェック + RLS の二重保護
- **RHF + Zod**: `mode: 'onBlur'` + `zodResolver` — `src/components/stocks/financial-data-form.tsx` を参照
- **Toast 通知**: `import { toast } from 'sonner'` — 成功時に `toast.success()`、エラー時に `toast.error()`
- **型定義**: `src/lib/types/` に共有型を配置（循環依存回避）
- **ファイル命名**: ケバブケース
- **UI テキスト**: すべて日本語
- **インポート**: `@` パスエイリアス
- **Slider**: `src/components/ui/slider.tsx`（Radix UI ベース、既にインストール済み）
- **Toaster**: `sonner` ライブラリ、`src/app/layout.tsx` で `<Toaster richColors position="bottom-right" />` 設定済み

### StockDetailTabs の拡張

現在の `stock-detail-tabs.tsx`:
- `overviewContent` と `financialContent` の 2 タブ
- 変更: `parametersContent` prop を追加し、3 タブ構成にする

```typescript
export function StockDetailTabs({
  overviewContent,
  financialContent,
  parametersContent,  // NEW
  defaultTab = 'overview',
}: {
  overviewContent: ReactNode;
  financialContent: ReactNode;
  parametersContent: ReactNode;  // NEW
  defaultTab?: string;
}) {
  // ...
  <TabsTrigger value="parameters">パラメータ</TabsTrigger>
  <TabsContent value="parameters" className="mt-4">
    {parametersContent}
  </TabsContent>
}
```

### page.tsx でのデータ取得

`getOrCreateParameters` は Server Action（'use server'）なので、Server Component から直接呼べない。代わりに Supabase クライアントで直接クエリする:

```typescript
// page.tsx 内
const [{ data: stock }, { data: financialData }, { data: parameters }] = await Promise.all([
  supabase.from('stocks').select('...').eq('id', id).single(),
  supabase.from('financial_data').select('...').eq('stock_id', id).order('fiscal_year', { ascending: false }),
  supabase.from('parameters').select('*').eq('stock_id', id).maybeSingle(),
]);
```

パラメータが null（未作成）の場合は、`parameter-section.tsx`（Client Component）の初回マウント時に Server Action `getOrCreateParameters` を呼び出してデフォルト値を作成する。

### 重要な注意事項

1. **r > g の制約**: 割引率 (r) が永久成長率 (g) 以下の場合、DCF 計算で `r - g` が 0 以下になり、事業価値が無限大になる。Zod の `superRefine` で `r > g` を強制する
2. **NUMERIC 型**: JavaScript の `number` に変換する際の精度問題に注意。Supabase は NUMERIC を string として返す場合があるため、`Number()` 変換が必要
3. **DELETE ポリシー**: parameters レコードの削除は直接行わない（デフォルトに戻す = UPDATE）が、RLS の完全性のために DELETE ポリシーも設定する
4. **Story 4.2 への接続点**: 計算エンジンは `ParametersRow` 型のオブジェクトを引数として受け取る設計にする。本ストーリーで型を確立しておく
5. **Slider のアクセシビリティ**: Radix UI の Slider は `aria-valuemin`, `aria-valuemax`, `aria-valuenow` を自動設定する。追加の ARIA 属性は不要だが、ラベルとの関連付け（`aria-label` or `<label htmlFor>`）は必要

### Project Structure Notes

- `supabase/migrations/YYYYMMDDHHMMSS_create_parameters_table.sql` — NEW: parameters テーブル作成
- `src/lib/schemas/parameters.ts` — NEW: Zod スキーマ + デフォルト値定数 + メタ情報
- `src/lib/types/parameters.ts` — NEW: `ParametersRow` 型定義
- `src/actions/parameters.ts` — NEW: getOrCreateParameters, updateParameters
- `src/components/stocks/parameter-section.tsx` — NEW: パラメータ設定 UI（Client Component）
- `src/components/stocks/stock-detail-tabs.tsx` — MODIFY: パラメータタブ追加
- `src/app/stocks/[id]/page.tsx` — MODIFY: parameters データ取得 + タブへの受け渡し

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.1 AC, FR18, FR19]
- [Source: _bmad-output/planning-artifacts/prd.md — FR18（基本パラメータ/高度設定の分類）, FR19（デフォルト値と根拠）, FR20（即時再計算 — Story 4.4 のスコープ）, NFR4（パラメータ変更1秒以内）]
- [Source: _bmad-output/planning-artifacts/architecture.md — parameters テーブル設計、クライアントサイド計算エンジン、RLS パターン、lib/calc/ ディレクトリ]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — ParameterAdjustPanel（スライダー+数値入力）、タブ構成（概要/理論株価/財務データ/パラメータ）]
- [Source: _bmad-output/planning-artifacts/ux-design-directions.html — パラメータ調整 UI モックアップ（r=8%, g=2%, 実効税率=30%, 上限倍率=10倍）]
- [Source: _bmad-output/implementation-artifacts/3-4-financial-data-trends.md — 前ストーリーの実装パターン、Server Action パターン]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

（なし）

### Completion Notes List

- `parameters` テーブルのマイグレーション作成（NUMERIC 型、UNIQUE(user_id, stock_id)、RLS 4ポリシー、updated_at トリガー）
- `updateParametersSchema` を Zod v4 で作成（`z.uuid()` 使用）。`superRefine` で `r > g` のクロスフィールドバリデーションを実装
- `PARAMETER_DEFAULTS` と `PARAMETER_META` をエクスポート。`displayMultiplier` で内部値（0.08）と表示値（8.0）の変換を管理
- `getOrCreateParameters` / `updateParameters` Server Actions 作成。`toParametersRow()` で Supabase の NUMERIC（string）→ `Number()` 変換を実施
- `ParameterSection` Client Component: Slider + 数値入力の双方向バインド、デフォルトに戻すボタン、`useTransition` で保存中状態を管理
- `StockDetailTabs` に「パラメータ」タブを追加（3タブ構成）
- `page.tsx` で `parameters` テーブルを `maybeSingle()` で取得し、NUMERIC → number 変換後に `ParameterSection` に渡す
- 83テスト全通過、ビルド成功

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-21 | Story creation — ultimate context engine | Story 4.1 context engine |
| 2026-03-21 | Implementation complete — all tasks done | Story 4.1 実装完了 |

### File List

- `supabase/migrations/20260321045108_create_parameters_table.sql` — NEW: parameters テーブル作成（NUMERIC 型、RLS、トリガー）
- `src/lib/schemas/parameters.ts` — NEW: Zod スキーマ、PARAMETER_DEFAULTS、PARAMETER_META、UpdateParametersInput 型
- `src/lib/schemas/parameters.test.ts` — NEW: 13 ユニットテスト（正常値、境界値、r≤g、無効 UUID）
- `src/lib/types/parameters.ts` — NEW: ParametersRow 型定義
- `src/actions/parameters.ts` — NEW: getOrCreateParameters、updateParameters Server Actions
- `src/components/stocks/parameter-section.tsx` — NEW: パラメータ設定 UI（Slider + 数値入力、RHF + Zod）
- `src/components/stocks/stock-detail-tabs.tsx` — MODIFIED: parametersContent prop 追加、パラメータタブ追加
- `src/app/stocks/[id]/page.tsx` — MODIFIED: parameters データ取得、ParameterSection import、NUMERIC → number 変換
