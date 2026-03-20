# Story 3.3: 財務データの修正

Status: review

## Story

As a ログイン済みユーザー,
I want 入力済みの財務データを修正したい,
so that 入力ミスや更新があった場合にデータを正確に保てる。（FR9）

## Acceptance Criteria

1. **AC1: 既存データの読み込みと復元**
   - Given 銘柄に財務データが登録されている状態
   - When 特定の期間のデータを選択して編集フォームを開く
   - Then 既存の値がフォームにプリフィルされる
   - And 保存時の円建て値が元の入力単位（`input_unit`）に逆変換されて表示される

2. **AC2: データの更新と保存**
   - Given 編集フォームで値を変更した状態
   - When 保存ボタンをクリックまたは Ctrl+S を押す
   - Then `financial_data` テーブルが更新される（INSERT ではなく UPDATE）
   - And Toast通知で「財務データを更新しました」と表示される
   - And 一覧に更新後の値が反映される

3. **AC3: 未保存変更の確認**
   - Given 編集フォームで変更を行っている状態
   - When 保存せずにフォームを閉じようとする（キャンセルボタン、または別のデータを選択）
   - Then 「未保存の変更があります。破棄しますか？」の確認が表示される

## Tasks / Subtasks

- [x] Task 1: 一覧に編集ボタンを追加 (AC: #1)
  - [x] 1.1 `src/components/stocks/financial-data-list.tsx` の各行に「編集」ボタンを追加する
  - [x] 1.2 クリック時に `onEdit(row)` コールバックを呼び出す（`onEdit` prop を追加）
  - [x] 1.3 一覧で `input_unit` も select するように `src/app/stocks/[id]/page.tsx` のクエリを修正する

- [x] Task 2: FinancialDataForm を新規/編集兼用に拡張 (AC: #1, #2)
  - [x] 2.1 `FinancialDataForm` に `editData` prop（`FullFinancialDataRow` | null）を追加する
  - [x] 2.2 `editData` がある場合、`fromYen` で逆変換した値を `defaultValues` にセットする（`shares_outstanding` と `current_stock_price` は逆変換不要）
  - [x] 2.3 編集モード時は期間属性（年度、四半期、連結区分）を読み取り専用にする（ユニーク制約の変更を防ぐ）
  - [x] 2.4 編集モード時は保存ボタンのラベルを「財務データを更新する」に変更する
  - [x] 2.5 「キャンセル」ボタンを追加し、クリック時に `onCancel` コールバックを呼び出す
  - [x] 2.6 編集モード時の重複検出を無効にする（自分自身との重複を回避）

- [x] Task 3: updateFinancialData Server Action を作成 (AC: #2)
  - [x] 3.1 `src/actions/financial-data.ts` に `updateFinancialData(id: string, data: CreateFinancialDataInput)` を追加する
  - [x] 3.2 既存の `createFinancialData` と同じバリデーション＋単位変換ロジックを `parseAndConvert` に抽出して共有する
  - [x] 3.3 `.update()` で指定 ID のレコードを更新し、`.eq('id', id)` と `.eq('user_id', user.id)` で RLS を担保する
  - [x] 3.4 `revalidatePath` で銘柄詳細ページを再検証する

- [x] Task 4: 親コンポーネントの状態管理 (AC: #1, #2, #3)
  - [x] 4.1 `src/components/stocks/financial-data-section.tsx` を Client Component として新規作成し、page.tsx から財務データUIを分離する
  - [x] 4.2 `editingData` 状態で編集中のレコードを管理する
  - [x] 4.3 一覧の `onEdit` → `setEditingData(row)` で編集フォームを表示する
  - [x] 4.4 フォームの `onSuccess` → `setEditingData(null)` で新規モードに戻す
  - [x] 4.5 フォームの `onCancel` → 未保存確認後に `setEditingData(null)` で閉じる

- [x] Task 5: 未保存変更の確認ダイアログ (AC: #3)
  - [x] 5.1 RHF の `formState.isDirty` を使用して変更検知を行う
  - [x] 5.2 キャンセルボタンクリック時に `isDirty` なら `window.confirm()` で確認する
  - [x] 5.3 `key={editData.id}` でコンポーネント再マウントにより、別データ編集時は自然にリセットされる

- [x] Task 6: テストとビルド確認 (AC: #1, #2, #3)
  - [x] 6.1 `npm run build` でビルド確認 — 成功
  - [x] 6.2 全テスト通過を確認（`npm test`）— 60 tests passing
  - [x] 6.3 ESLint チェック — ビルド成功に含まれる
  - [x] 6.4 キーボード操作・アクセシビリティのセルフチェック — 編集ボタンに aria-label、disabled フィールド、セマンティック HTML 維持

## Dev Notes

### 既に Story 3.1/3.2 で実装済みの基盤

**変更不要:**
- Zod スキーマ `createFinancialDataSchema` — 新規/編集共通で使用可能
- `mode: 'onBlur'` + `zodResolver` + `as any` キャスト — パターン継続
- `form.getValues()` で生の文字列値を Server Action に送信するパターン
- sonner Toast 通知
- `toYen` / `fromYen` 単位変換ユーティリティ（`fromYen` は今回初使用）
- `.superRefine()` ビジネスロジックバリデーション
- Alert コンポーネントでの重複警告バナー（amber スタイル）
- `onInvalid` コールバックで Collapsible 自動展開

### 編集フォームの設計方針

**新規コンポーネント vs 既存拡張:**
`FinancialDataForm` を拡張して新規/編集兼用にする。理由:
- フォームの構造（フィールド、バリデーション、レイアウト）が同一
- props で `editData` の有無を判定し、新規 vs 編集を切り替える
- Server Action の呼び分けは `editData ? updateFinancialData : createFinancialData`

**逆変換の設計:**

DB に保存された円建て値を元の `input_unit` で逆変換してフォームに表示する。

```typescript
// editData が渡された場合の defaultValues 生成例
const unit = editData.input_unit as InputUnit;
const defaultValues = {
  stock_id: stockId,
  fiscal_year: editData.fiscal_year,
  fiscal_quarter: editData.fiscal_quarter,
  consolidation_type: editData.consolidation_type,
  // 金額フィールドは fromYen で逆変換し、文字列化
  revenue: String(fromYen(editData.revenue, unit)),
  operating_income: String(fromYen(editData.operating_income, unit)),
  // ... 他の金額フィールドも同様
  // shares_outstanding, current_stock_price は逆変換不要
  shares_outstanding: editData.shares_outstanding != null ? String(editData.shares_outstanding) : '',
  current_stock_price: editData.current_stock_price != null ? String(editData.current_stock_price) : '',
  input_unit: editData.input_unit,
};
```

**重要: `fromYen` の端数処理**
`fromYen` は除算なので小数が発生する可能性がある。例: 1,234,567 円 ÷ 1,000,000 = 1.234567。フォームには文字列として表示するため、`String()` で変換すれば自然な表示になる。ただし、ユーザーがカンマ付きで入力した値を逆変換する場合は常に数値になるため問題はない。

### 期間属性の読み取り専用化

編集モードでは年度・四半期・連結区分を変更不可にする。理由:
- ユニーク制約 `(user_id, stock_id, fiscal_year, fiscal_quarter, consolidation_type)` の一部であり、変更すると既存データとの重複が発生する可能性がある
- 期間を変えたい場合は「削除して新規作成」のワークフローが適切

実装: `<Input disabled>` / `<Select disabled>` で視覚的にもグレーアウトする。

### Client Component の切り出し

現在の `src/app/stocks/[id]/page.tsx` は Server Component で、財務データの一覧表示と新規フォーム表示を静的に行っている。編集状態（`editingData`）を管理するには Client Component が必要。

**設計:**
```
src/app/stocks/[id]/page.tsx (Server Component — データ取得のみ)
  └─ src/components/stocks/financial-data-section.tsx (Client Component — NEW)
       ├─ FinancialDataList (既存 — onEdit prop 追加)
       ├─ FinancialDataForm (既存 — editData prop 追加)
       └─ FinancialDataEmpty (既存 — 変更なし)
```

**`FinancialDataSection`** が `editingData` 状態を持ち、一覧からの編集選択→フォーム表示→保存後の状態リセットを管理する。

### Server Action の重複排除

`createFinancialData` と `updateFinancialData` でバリデーション＋単位変換ロジックが重複する。共通ヘルパーの抽出を検討する:

```typescript
// 共通ヘルパー（actions/financial-data.ts 内）
function parseAndConvert(data: CreateFinancialDataInput) {
  const parsed = createFinancialDataSchema.safeParse(data);
  if (!parsed.success) return { success: false as const, error: '入力内容に誤りがあります' };
  // ... unit conversion logic ...
  return { success: true as const, parsed, converted, user };
}
```

### 一覧の拡張 — select に `input_unit` を追加

現在の Supabase クエリは `input_unit` を select していない。編集フォームで逆変換するために必要:

```typescript
// page.tsx のクエリに input_unit を追加
.select(
  'id, fiscal_year, fiscal_quarter, consolidation_type, revenue, operating_income, net_income, total_assets, equity, input_unit, interest_bearing_debt, operating_cf, investing_cf, shares_outstanding, interest_expense, current_stock_price'
)
```

**注意:** 編集フォームではオプションフィールド（有利子負債、営業CF等）もプリフィルする必要があるため、全カラムを select する。

### 確立されたコードパターン（Story 3.1/3.2 から継承）

- **Server Action パターン**: `{ success: boolean; error?: string }` — 変更なし
- **RHF + Zod**: `mode: 'onBlur'` + `zodResolver` + `as any` キャスト — 変更なし
- **Toast**: sonner — 変更なし
- **フォーム値の送信**: `form.getValues()` で生の文字列値を Server Action に送信
- **ファイル命名**: ケバブケース
- **UI テキスト**: すべて日本語
- **インポート**: `@` パスエイリアス

### 重要な注意事項

1. **`form.reset()` のタイミング**: 編集完了後に `form.reset()` を呼ぶと新規フォームの defaultValues に戻る。編集モード解除は親コンポーネント側で `setEditingData(null)` → React の再マウントで自然にリセットされるので、明示的な `reset()` は不要かもしれない。`key` prop で制御するとクリーン
2. **`editData` 変更時のフォームリセット**: `editData` が変わったとき（別のレコードを編集）は `useEffect` + `form.reset(newDefaultValues)` か、`key={editData?.id}` でコンポーネントを再マウントする。**`key` prop が最もシンプル**
3. **RLS**: `updateFinancialData` では `.eq('user_id', user.id)` を必ず付与すること。Supabase RLS が有効でも、Server Action 側でも防御的にチェックする
4. **`revalidatePath`**: 更新後に銘柄詳細ページを再検証して、Server Component のデータを最新にする
5. **編集モード時の重複検出**: `isDuplicate` チェックは `editData` がある場合は無効にするか、自分自身のレコードを除外する

### Project Structure Notes

- `src/components/stocks/financial-data-section.tsx` — NEW: 財務データセクションの状態管理 Client Component
- `src/components/stocks/financial-data-form.tsx` — MODIFY: `editData` prop 追加、編集モード対応
- `src/components/stocks/financial-data-list.tsx` — MODIFY: `onEdit` prop 追加、編集ボタン追加
- `src/actions/financial-data.ts` — MODIFY: `updateFinancialData` Server Action 追加
- `src/app/stocks/[id]/page.tsx` — MODIFY: クエリ拡張、FinancialDataSection に切り替え

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.3 AC, FR9]
- [Source: _bmad-output/planning-artifacts/prd.md — FR9（既存財務データの編集・削除）]
- [Source: _bmad-output/planning-artifacts/architecture.md — Server Actions パターン、Supabase RLS]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — 編集フロー、未保存確認、段階的開示]
- [Source: _bmad-output/implementation-artifacts/3-1-financial-data-input-form.md — フォーム基盤、単位変換、Server Action パターン]
- [Source: _bmad-output/implementation-artifacts/3-2-financial-data-validation.md — バリデーション基盤、重複検出]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `FormValues` の enum リテラル型に `FullFinancialDataRow` の `string` 型を代入できない → `as FormValues['fiscal_quarter']` でキャスト

### Completion Notes List

- `FinancialDataSection` Client Component を新設し、page.tsx (Server Component) から財務データの状態管理を分離
- `FinancialDataForm` を新規/編集兼用に拡張: `editData` prop で編集モード制御、`key={editData.id}` で再マウント
- `buildDefaultValues()` ヘルパーで `fromYen` 逆変換を実施（`shares_outstanding`, `current_stock_price` は除外）
- `parseAndConvert()` 共通ヘルパーを抽出し、`createFinancialData` と `updateFinancialData` で重複排除
- 編集モード時は期間属性を disabled、重複検出を無効化
- 未保存変更の確認: `formState.isDirty` + `window.confirm()`
- 一覧に Pencil 編集ボタン追加、`aria-label` でアクセシビリティ対応
- オプションフィールドに値がある場合は Collapsible を自動展開
- 60テスト全通過、ビルド成功

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-21 | Story creation — ultimate context engine | Story 3.3 context engine |
| 2026-03-21 | Implementation complete — all tasks done | Story 3.3 実装完了 |

### File List

- `src/components/stocks/financial-data-section.tsx` — NEW: 財務データセクション状態管理 Client Component（`FullFinancialDataRow` 型、`editingData` 状態）
- `src/components/stocks/financial-data-form.tsx` — MODIFIED: `editData` prop、`onCancel` prop、`buildDefaultValues` ヘルパー、編集モード UI（disabled 期間属性、更新ボタン、キャンセルボタン）
- `src/components/stocks/financial-data-list.tsx` — MODIFIED: `onEdit` prop、Pencil 編集ボタン、`FullFinancialDataRow` 型に拡張
- `src/actions/financial-data.ts` — MODIFIED: `parseAndConvert` 共通ヘルパー抽出、`updateFinancialData` Server Action 追加
- `src/app/stocks/[id]/page.tsx` — MODIFIED: Supabase クエリを全カラム取得に拡張、`FinancialDataSection` に切り替え
