# Story 3.2: 財務データのバリデーション

Status: done

## Story

As a ログイン済みユーザー,
I want 入力した財務データの妥当性が自動的にチェックされてほしい,
so that 入力ミスに早期に気づき、正確なデータに基づいた分析ができる。（FR11）

## Acceptance Criteria

1. **AC1: onBlurバリデーション実行**
   - Given 財務データ入力フォームに値を入力中
   - When フィールドからフォーカスが外れる（onBlur）
   - Then Zodスキーマによるバリデーションが即座に実行され、エラーがあればフィールド直下に赤テキストで表示される
   - And `aria-describedby` でエラーメッセージがフィールドに紐付けられている

2. **AC2: ビジネスロジックバリデーション**
   - Given 財務データ入力フォームが表示されている
   - When 売上高・総資産に負の値を入力する
   - Then 「売上高は0以上の値を入力してください」等のエラーが表示される
   - And 自己資本 > 総資産 の場合、「自己資本が総資産を超えています」の警告が表示される

3. **AC3: 同一期間の重複検出（クライアントサイド）**
   - Given 銘柄に既存の財務データがある状態
   - When 既に登録済みの期間（年度＋四半期＋連結区分）を選択する
   - Then フォーム上部に「この期間のデータは既に登録されています」の警告が表示される
   - And 保存ボタン押下時にもサーバーサイドで二重チェックされる（23505エラーハンドリング済み）

4. **AC4: エラー時のフォーカス制御**
   - Given フォームにバリデーションエラーがある状態
   - When 保存ボタンをクリックまたはCtrl+Sを押す
   - Then 最初のエラーフィールドに自動的にスクロール＋フォーカスが移動する
   - And 保存処理は実行されない

## Tasks / Subtasks

- [x] Task 1: ビジネスロジックバリデーションの追加 (AC: #2)
  - [x] 1.1 `src/lib/schemas/financial-data.ts` の `createFinancialDataSchema` に `.superRefine()` でクロスフィールドバリデーションを追加する
    - 売上高（revenue）: 0以上であること
    - 総資産（total_assets）: 0より大きいこと
    - 自己資本 ≤ 総資産 のクロスフィールドチェック
  - [x] 1.2 `src/lib/schemas/financial-data.test.ts` にビジネスロジックバリデーションのテスト5件を追加する

- [x] Task 2: クライアントサイド重複検出 (AC: #3)
  - [x] 2.1 `src/components/stocks/financial-data-form.tsx` に `existingPeriods` prop を追加する
  - [x] 2.2 `useMemo` で年度・四半期・連結区分の watch 値と既存データの重複をリアクティブにチェックする
  - [x] 2.3 重複時にフォーム上部に `Alert` + `AlertTriangle` アイコンで警告バナーを表示する
  - [x] 2.4 `src/app/stocks/[id]/page.tsx` から既存期間データを FinancialDataForm に渡す

- [x] Task 3: エラー時のフォーカス制御 (AC: #4)
  - [x] 3.1 `useForm` に `shouldFocusError: true` を明示的に設定する
  - [x] 3.2 `onInvalid` コールバックでオプションフィールドのエラー時に Collapsible を自動展開する

- [x] Task 4: テストとビルド確認 (AC: #1, #2, #3, #4)
  - [x] 4.1 `npm run build` でビルド確認 — 成功
  - [x] 4.2 全テスト通過を確認（`npm test`）— 59 tests passing
  - [x] 4.3 ESLint チェック — クリーン
  - [x] 4.4 キーボード操作のセルフチェック — セマンティック HTML + shouldFocusError + onInvalid 自動展開で対応

## Dev Notes

### 既に Story 3.1 で実装済みの基盤

Story 3.1 で以下のバリデーション基盤は **既に実装済み** である。この Story では追加のビジネスロジックとUX改善に集中する。

**実装済み（変更不要）:**
- Zod スキーマによる形式バリデーション（正規表現、数値型チェック）
- `mode: 'onBlur'` による入力離脱時バリデーション（AC1 は基本的に実装済み）
- サーバーサイド重複検出（23505 エラーコード → エラーメッセージ表示）
- `aria-describedby` による shadcn/ui Form のアクセシビリティ連携
- カンマ付き数値の受け付け・正規化
- 負値の許容（営業赤字等に対応）
- 四半期/連結区分/単位の enum バリデーション
- 年度の範囲チェック（1900-2100）
- 12件の Zod スキーマテスト

### ビジネスロジックバリデーションの設計

PRD の FR11 と Domain-Specific Requirements から導出:
> 「入力値の妥当性チェック（例：自己資本比率が0〜100%の範囲か、売上高が負値でないか等）は最低限の入力バリデーションとして実装する」

**実装方針: Zod `.superRefine()` を使用**

```typescript
// createFinancialDataSchema に .superRefine() を追加
export const createFinancialDataSchema = z.object({
  // ...existing fields...
}).superRefine((data, ctx) => {
  // 売上高は 0 以上（赤字は営業利益/純利益のみ許容）
  if (data.revenue < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '売上高は0以上の値を入力してください',
      path: ['revenue'],
    });
  }
  // 総資産は 0 以上
  if (data.total_assets <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '総資産は0より大きい値を入力してください',
      path: ['total_assets'],
    });
  }
  // 自己資本 ≤ 総資産（警告的チェック — 通常は超えないが、特殊事象で超えうるため warning path）
  if (data.equity > data.total_assets) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '自己資本が総資産を超えています。入力値を確認してください',
      path: ['equity'],
    });
  }
});
```

**重要:** `.superRefine()` は transform 後の数値に対して実行される。Zod パイプラインは `string → transform(Number) → pipe(z.number()) → superRefine()` の順。

**注意:** `superRefine()` を追加すると、zodResolver の型推論に影響する可能性がある。Story 3.1 で `as any` キャストを使用しているため、型互換性の問題は発生しないはず。ただしビルドで確認すること。

### クライアントサイド重複検出の設計

現在の Server Action による 23505 エラー検出は**保存時**にしか発動しない。UX を改善するため、**期間選択時**にクライアントサイドで重複をプリチェックする。

```typescript
// FinancialDataForm に追加する prop
type ExistingPeriod = {
  fiscal_year: number;
  fiscal_quarter: string;
  consolidation_type: string;
};

export function FinancialDataForm({
  stockId,
  existingPeriods = [],  // ← NEW
  onSuccess,
}: {
  stockId: string;
  existingPeriods?: ExistingPeriod[];
  onSuccess?: () => void;
}) {
  // ...
  const watchedYear = form.watch('fiscal_year');
  const watchedQuarter = form.watch('fiscal_quarter');
  const watchedType = form.watch('consolidation_type');

  const isDuplicate = existingPeriods.some(
    (p) =>
      p.fiscal_year === watchedYear &&
      p.fiscal_quarter === watchedQuarter &&
      p.consolidation_type === watchedType
  );
  // isDuplicate が true の場合、Alert コンポーネントで警告表示
}
```

**親コンポーネントからのデータ受け渡し:**

`src/app/stocks/[id]/page.tsx` で既にクエリ済みの `financialData` から期間情報を抽出して渡す:

```typescript
const existingPeriods = (financialData ?? []).map((d) => ({
  fiscal_year: d.fiscal_year,
  fiscal_quarter: d.fiscal_quarter,
  consolidation_type: d.consolidation_type,
}));

<FinancialDataForm stockId={stock.id} existingPeriods={existingPeriods} />
```

### エラー時のフォーカス制御

React Hook Form の `shouldFocusError: true`（デフォルト）は最初のエラーフィールドにフォーカスを移動する。ただし、Collapsible 内のフィールドがエラーの場合、Collapsible が閉じている状態ではフォーカスが効かない可能性がある。

**対策:**
- `onInvalid` コールバックで、エラーがオプションフィールドにある場合は Collapsible を開く
- その後、最初のエラーフィールドにスクロール

```typescript
const onInvalid = useCallback((errors: FieldErrors<FormValues>) => {
  const optionalFieldNames = OPTIONAL_FIELDS.map((f) => f.name);
  const hasOptionalError = Object.keys(errors).some((key) =>
    optionalFieldNames.includes(key as any)
  );
  if (hasOptionalError && !optionalOpen) {
    setOptionalOpen(true);
  }
  // RHF の shouldFocusError が自動的に最初のエラーフィールドにフォーカスする
}, [optionalOpen]);

// form.handleSubmit(onSubmit, onInvalid) で使用
```

### shadcn/ui Alert コンポーネント

重複検出の警告バナーには shadcn/ui の Alert を使用する。

```bash
npx shadcn@latest add alert
```

既にインストール済みか確認すること。未インストールの場合のみ追加する。

### 確立されたコードパターン（Story 3.1 から継承）

- **Server Action パターン**: `{ success: boolean; error?: string }` — 変更なし
- **RHF + Zod**: `mode: 'onBlur'` + `zodResolver` + `as any` キャスト — 変更なし
- **Toast**: sonner — 変更なし
- **フォーム値の送信**: `form.getValues()` で生の文字列値を Server Action に送信（zodResolver の transform 済み値ではなく）
- **ファイル命名**: ケバブケース
- **UI テキスト**: すべて日本語
- **インポート**: `@` パスエイリアス

### 重要な注意事項

1. **`.superRefine()` の位置**: `.object({...})` の後に付ける。transform パイプラインの後に実行されるため、`data.revenue` は既に number 型
2. **クライアントサイド重複チェックは UX 改善のみ**: サーバーサイドの 23505 エラーハンドリングは引き続き防御線として維持する。クライアントチェックは「送信前の親切な警告」の位置づけ
3. **Collapsible の自動展開**: オプションフィールドにエラーがある場合、Collapsible を自動的に開かないとフォーカス移動が効かない
4. **`shouldFocusError`**: RHF v7+ ではデフォルト `true`。明示的に設定して意図を明確にする
5. **Alert コンポーネント**: shadcn/ui の `Alert`, `AlertTitle`, `AlertDescription` を使用。`variant="destructive"` ではなくデフォルトまたはカスタムの amber スタイルで「警告」を表現する
6. **テスト追加**: ビジネスロジックバリデーションのテストは既存の 12 テストに追加する形で。テストファイルは `financial-data.test.ts` を拡張

### Project Structure Notes

- `src/lib/schemas/financial-data.ts` — MODIFY: `.superRefine()` でビジネスロジックバリデーション追加
- `src/lib/schemas/financial-data.test.ts` — MODIFY: ビジネスロジックバリデーションのテスト追加
- `src/components/stocks/financial-data-form.tsx` — MODIFY: `existingPeriods` prop、重複検出 UI、`onInvalid` コールバック、Collapsible 自動展開
- `src/app/stocks/[id]/page.tsx` — MODIFY: `existingPeriods` を FinancialDataForm に渡す
- `src/components/ui/alert.tsx` — NEW (if not installed): shadcn/ui Alert コンポーネント
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFY: ステータス更新

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.2 AC, FR11]
- [Source: _bmad-output/planning-artifacts/prd.md — FR11（入力値妥当性チェック）、Domain-Specific Requirements（財務データ整合性）]
- [Source: _bmad-output/planning-artifacts/architecture.md — Zod バリデーション層、統一エラーレスポンスパターン]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — バリデーションタイミング、エラー表示パターン、前期比異常値検出（amber badge）、フォーカス制御]
- [Source: _bmad-output/implementation-artifacts/3-1-financial-data-input-form.md — 既存バリデーション基盤、コードパターン、form.getValues() パターン]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `Set<string>` 型の明示的アノテーションで `optionalFieldNames.has(key)` の型エラーを解決

### Completion Notes List

- `.superRefine()` で3つのビジネスロジックバリデーション追加（売上高非負、総資産正、自己資本≤総資産）
- `existingPeriods` prop + `useMemo` によるクライアントサイド重複検出
- Alert コンポーネント（shadcn/ui）で重複警告バナー表示
- `onInvalid` コールバックでオプションフィールドエラー時の Collapsible 自動展開
- `shouldFocusError: true` 明示設定
- 60 テスト全通過（新規6テスト追加）、ビルド成功、lint クリーン

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-17 | Story creation — ultimate context engine | Story 3.2 context engine |
| 2026-03-19 | Implementation complete — all tasks done | Story 3.2 実装完了 |
| 2026-03-21 | Code review fixes — M1: focus after Collapsible open, M2: immutable sort, L1: negative total_assets test, L2: stable onInvalid ref, L3: amber alert styling | コードレビュー指摘対応 |

### File List

- `src/lib/schemas/financial-data.ts` — MODIFIED: `.superRefine()` でビジネスロジックバリデーション追加
- `src/lib/schemas/financial-data.test.ts` — MODIFIED: 6テスト追加 (12→18)
- `src/components/stocks/financial-data-form.tsx` — MODIFIED: existingPeriods prop、重複検出、onInvalid、shouldFocusError
- `src/app/stocks/[id]/page.tsx` — MODIFIED: existingPeriods を FinancialDataForm に渡す
- `src/components/ui/alert.tsx` — NEW: shadcn/ui Alert コンポーネント
