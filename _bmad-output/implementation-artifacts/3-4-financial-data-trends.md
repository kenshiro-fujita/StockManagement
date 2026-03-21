# Story 3.4: 財務データ推移の閲覧

Status: done

## Story

As a ログイン済みユーザー,
I want 銘柄ごとの財務データの推移を複数期分まとめて閲覧したい,
so that 企業の業績トレンドを把握できる。（FR10）

## Acceptance Criteria

1. **AC1: 時系列テーブル表示**
   - Given 銘柄に複数期分の財務データが登録されている
   - When 「財務データ」タブを開く
   - Then 登録済みの全期間のデータが時系列（新しい期間→古い期間）でテーブル形式で表示される
   - And 主要項目（売上、営業利益、純利益、総資産、自己資本）が一目で比較できるレイアウトになっている

2. **AC2: スクリーンリーダー対応**
   - Given 財務データ推移テーブルが表示されている
   - When スクリーンリーダーで読み上げる
   - Then セマンティックな `<table>` 要素で構成されており、ヘッダーとデータの関係が適切に読み上げられる

3. **AC3: 1期分のみのガイダンス**
   - Given 財務データが1期分のみ登録されている
   - When 推移を表示する
   - Then 1期分のデータが表示され、「複数期のデータを入力すると推移を比較できます」のガイダンスが表示される

## Tasks / Subtasks

- [x] Task 1: 1期分のみ登録時のガイダンスメッセージを追加 (AC: #3)
  - [x] 1.1 `src/components/stocks/financial-data-section.tsx` で `financialData.length === 1` の場合に「複数期のデータを入力すると推移を比較できます」のガイダンスを表示する
  - [x] 1.2 ガイダンスは `<p>` 要素で `text-muted-foreground` スタイル、テーブルの下に配置する
  - [x] 1.3 0件（Empty State）と1件（ガイダンス）と2件以上（通常表示）を区別する

- [x] Task 2: 前年比変化率の表示を追加 (AC: #1)
  - [x] 2.1 `financial-data-list.tsx` で同じ `fiscal_quarter` × `consolidation_type` の前年データを検索し、売上・営業利益・純利益の前年比変化率を計算する
  - [x] 2.2 変化率をテーブルの各金額セルの下に小さいテキスト（`text-xs`）で表示する（例: `+12.3%`, `-5.1%`）
  - [x] 2.3 増加はグリーン（`text-green-600`）、減少はレッド（`text-red-600`）で色分けする（色だけでなく `+` / `-` 記号でも情報伝達する — NFR14）
  - [x] 2.4 前年データが存在しない場合は変化率を表示しない
  - [x] 2.5 `aria-label` で「前年比 +12.3% 増加」のようにスクリーンリーダー向け情報を付与する

- [x] Task 3: テーブルのアクセシビリティ強化 (AC: #2)
  - [x] 3.1 テーブルに `<caption>` 要素で「財務データ推移」を追加する（スクリーンリーダー向け）
  - [x] 3.2 セマンティック `<table>` 構造（`<th>` + `<td>`）によりスクリーンリーダーがヘッダーとセルの関係を自動読み上げすることを確認（明示的 `aria-label` は冗長のため省略）

- [x] Task 4: テストとビルド確認 (AC: #1, #2, #3)
  - [x] 4.1 `npm run build` でビルド確認 — 成功
  - [x] 4.2 全テスト通過を確認（`npm test`）— 60 tests passing
  - [x] 4.3 キーボード操作・アクセシビリティのセルフチェック — caption, aria-label, 色+記号での方向表示

## Dev Notes

### 既に Story 3.1-3.3 で実装済みの基盤

**変更不要:**
- Zod スキーマ `createFinancialDataSchema` — そのまま
- Server Actions (`createFinancialData`, `updateFinancialData`) — 変更不要
- `FinancialDataForm` — 変更不要
- `financial-data-empty.tsx` — 0件時の Empty State（変更不要）
- `financial-data-section.tsx` — 状態管理（小修正のみ）
- page.tsx のデータ取得クエリとソートロジック — 変更不要

**既に満たされている AC:**
- AC1 のテーブル形式表示 — `financial-data-list.tsx` の `<Table>` で実装済み
- AC1 の時系列ソート — page.tsx の `sortedFinancialData` で実装済み（年度降順 → FY, Q4, Q3, Q2, Q1 の順）
- AC2 のセマンティック `<table>` — shadcn/ui の Table コンポーネントで実装済み（`<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` 構造）
- 百万円単位フォーマット — `formatAmount()` 関数で実装済み

### 本ストーリーで追加する新機能

**1. 1期分のみのガイダンス (Task 1)**
`financial-data-section.tsx` にガイダンスメッセージを追加する。既存の `hasFinancialData` チェック（0件 vs 1件以上）を拡張して、1件の場合のメッセージを追加する。

```typescript
// financial-data-section.tsx 内
const isSinglePeriod = financialData.length === 1;

// テーブル表示後に:
{isSinglePeriod && (
  <p className="text-muted-foreground text-sm">
    複数期のデータを入力すると推移を比較できます
  </p>
)}
```

**2. 前年比変化率 (Task 2)**
`financial-data-list.tsx` にて、同じ `fiscal_quarter` + `consolidation_type` の前年データを照合して変化率を計算する。

重要な設計判断:
- 変化率の計算はクライアントサイドで行う（データは既にすべてロード済み）
- `data` 配列を Map にインデックス化して O(1) で前年データを検索する
- 前年比は売上・営業利益・純利益の3項目のみ表示（総資産・自己資本はストック指標のため前年比の意味合いが異なる）
- 色覚障碍者のために色だけでなく `+` / `-` 記号でも方向を示す（NFR14 準拠）

```typescript
// key = "FY:consolidated:2025" のような形式で前年データを検索
type PeriodKey = string;
const dataByPeriod = new Map<PeriodKey, FullFinancialDataRow>();
for (const row of data) {
  const key = `${row.fiscal_quarter}:${row.consolidation_type}:${row.fiscal_year}`;
  dataByPeriod.set(key, row);
}

function getPrevYearRow(row: FullFinancialDataRow): FullFinancialDataRow | undefined {
  const key = `${row.fiscal_quarter}:${row.consolidation_type}:${row.fiscal_year - 1}`;
  return dataByPeriod.get(key);
}

function formatChangeRate(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const rate = ((current - previous) / Math.abs(previous)) * 100;
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}
```

**3. テーブル `<caption>` (Task 3)**
shadcn/ui の Table コンポーネントは `<caption>` のサポートがないため、直接 JSX で追加する。`sr-only` クラスで視覚的には非表示にしつつ、スクリーンリーダーには読み上げさせる。

### 確立されたコードパターン（Story 3.1-3.3 から継承）

- **Server Action パターン**: `{ success: boolean; error?: string }` — 今回は変更なし
- **RHF + Zod**: `mode: 'onBlur'` + `zodResolver` — 今回は変更なし
- **型定義**: `FullFinancialDataRow` は `src/lib/types/financial-data.ts` に定義（Story 3.3 レビューで循環依存解消済み）
- **ファイル命名**: ケバブケース
- **UI テキスト**: すべて日本語
- **インポート**: `@` パスエイリアス
- **テーブルコンポーネント**: shadcn/ui の `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- **金額フォーマット**: `formatAmount()` — 円→百万円変換、`Intl.NumberFormat('ja-JP')` でカンマ区切り
- **ソート順**: fiscal_year 降順 → fiscal_quarter (FY, Q4, Q3, Q2, Q1)

### 重要な注意事項

1. **色のアクセシビリティ**: 変化率の色分けは NFR14「色のみに依存する情報伝達を行わないこと」に準拠する。`+` / `-` 記号を必ず付与する
2. **パフォーマンス**: 前年データの Map 作成は `useMemo` でメモ化する。通常の使用では数十行程度なのでパフォーマンス問題はないが、コードの意図を明確にするため
3. **変化率の対象**: 売上・営業利益・純利益のフロー指標のみ。総資産・自己資本はストック指標のため前年比の意味合いが異なるので対象外
4. **前年データの照合条件**: `fiscal_quarter` + `consolidation_type` + `fiscal_year - 1` が一致するレコード。連結/単体が混在している場合は正しく分離される
5. **`financial-data-list.tsx` は 'use client'**: Story 3.3 で Client Component に変更済み。`useMemo` が使用可能

### Project Structure Notes

- `src/components/stocks/financial-data-list.tsx` — MODIFY: 前年比変化率表示、`<caption>` 追加、`aria-label` 強化
- `src/components/stocks/financial-data-section.tsx` — MODIFY: 1期分のみのガイダンスメッセージ追加

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.4 AC, FR10]
- [Source: _bmad-output/planning-artifacts/prd.md — FR10（財務データ推移閲覧）、NFR14（色のみに依存しない）]
- [Source: _bmad-output/planning-artifacts/architecture.md — Server Components パターン、Vitest]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — テーブル表示、Empty State ガイダンス]
- [Source: _bmad-output/implementation-artifacts/3-3-financial-data-edit.md — 前ストーリーの実装パターン、FullFinancialDataRow 型]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

（なし）

### Completion Notes List

- `financial-data-section.tsx` に `isSinglePeriod` 判定とガイダンスメッセージを追加（AC3）
- `financial-data-list.tsx` に前年比変化率の計算・表示機能を追加: `buildPeriodMap` で O(1) 検索、`ChangeRateLabel` コンポーネントでグリーン/レッド色分け + `+`/`-` 記号（NFR14 準拠）
- テーブルに `<caption className="sr-only">` を追加（AC2）
- 変化率の `aria-label` で「前年比 +12.3% 増加」をスクリーンリーダーに提供
- `useMemo` で `periodMap` をメモ化
- 60テスト全通過、ビルド成功

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-21 | Story creation — ultimate context engine | Story 3.4 context engine |
| 2026-03-21 | Implementation complete — all tasks done | Story 3.4 実装完了 |

### File List

- `src/components/stocks/financial-data-list.tsx` — MODIFIED: 前年比変化率（`calcChangeRate`, `ChangeRateLabel`）、`<caption>` 追加、`useMemo` による `periodMap`
- `src/components/stocks/financial-data-section.tsx` — MODIFIED: `isSinglePeriod` ガイダンスメッセージ追加
