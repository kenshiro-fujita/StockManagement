# Story 4.3: 理論株価詳細ビュー

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ログイン済みユーザー,
I want 銘柄ごとに理論株価関連の全指標を一覧で閲覧し、現在の市場価格と比較したい,
so that 投資判断に必要な情報を一目で把握できる。（FR22, FR23）

## Acceptance Criteria

1. **AC1: 全指標の一覧表示**
   - Given 銘柄に財務データとパラメータが登録されている
   - When 銘柄詳細ページの「理論株価」タブを開く
   - Then 全指標（ROE, PER, 理論株価, 安全域等）がカテゴリ別に一覧で表示される

2. **AC2: 理論株価と市場価格の比較表示**
   - Given 理論株価が算出されている
   - When 「理論株価」タブを確認する
   - Then 理論株価と現在の市場価格が並べて表示され、乖離率（安全域/安全率）が視覚的に明示される

3. **AC3: Empty State**
   - Given 財務データが未入力の銘柄の場合
   - When 「理論株価」タブを開く
   - Then 「財務データを入力すると理論株価が算出されます」のガイダンスが表示される

4. **AC4: アクセシビリティ**
   - Given 理論株価ビューが表示されている
   - When スクリーンリーダーで読み上げる
   - Then 各指標のラベルと値が適切に読み上げられる（WCAG 2.1 Level AA）

## Tasks / Subtasks

- [x] Task 1: 「理論株価」タブの追加（AC: #1, #3）
  - [x] 1.1 `stock-detail-tabs.tsx` のタブ順序を「概要→理論株価→財務データ→パラメータ」に変更
  - [x] 1.2 `TheoryPriceSection` コンポーネントの骨格を作成
  - [x] 1.3 `page.tsx` から `calculateAllIndicators()` を呼び出し、結果を `TheoryPriceSection` に渡す
  - [x] 1.4 財務データ未入力時の Empty State を実装
- [x] Task 2: 指標カテゴリ別表示コンポーネント（AC: #1）
  - [x] 2.1 `IndicatorSection` コンポーネント（カテゴリヘッダー + 指標リスト）を作成
  - [x] 2.2 `IndicatorRow` コンポーネント（ラベル + 値 + 単位の行表示）を作成（dl/dd パターンで実装）
  - [x] 2.3 8カテゴリ別セクション（収益性、成長性、CF、資本効率、株式指標、理論価値、理論PER系、安全性）を構成
- [x] Task 3: 理論株価 vs 市場価格の比較表示（AC: #2）
  - [x] 3.1 比較サマリーヘッダー（現在株価、現状理論株価、成長込理論株価、安全率）を作成
  - [x] 3.2 安全率に応じた視覚的バッジ（割安/適正/割高）を実装
  - [x] 3.3 `current_stock_price` が null の場合、比較部分を非活性表示
- [x] Task 4: 数値フォーマットと表示ヘルパー（AC: #1, #2）
  - [x] 4.1 金額の表示フォーマッタ（円、百万円、億円の自動切替）を作成
  - [x] 4.2 パーセンテージ表示フォーマッタ（符号付き、色分け）を作成
  - [x] 4.3 倍率表示フォーマッタ（PER/PBR 用、○○倍）を作成
  - [x] 4.4 null 値の表示（「—」ダッシュ）を統一
- [x] Task 5: アクセシビリティ対応（AC: #4）
  - [x] 5.1 セマンティック HTML（`<dl>` + `aria-labelledby` で見出し階層）を使用
  - [x] 5.2 各指標に `aria-label` を付与（例：「自己資本比率 50%」）
  - [x] 5.3 色のみに依存しない情報伝達（バッジにテキストラベル＋アイコン併用）
  - [x] 5.4 キーボードフォーカスの確認（タブ切替のみ、指標はインタラクティブ要素なし）
- [x] Task 6: テスト（AC: #1-#4）
  - [x] 6.1 getValuationLevel ロジックテスト（バッジ判定: 割安/適正/割高/null）
  - [x] 6.2 Empty State テスト（results=null 時にコンポーネントがレンダリング可能）
  - [x] 6.3 null 値ハンドリングはフォーマッタテストでカバー
  - [x] 6.4 フォーマッタのユニットテスト（17テストケース）
  - 注: コンポーネントレンダリングテスト（6.1-6.2の詳細版）は @testing-library/react 未導入のため、ロジックテストで代替

## Dev Notes

### 計算エンジンの呼び出しパターン

Story 4.2 で実装済みの `calculateAllIndicators()` を使用する。この関数は**純粋な TypeScript 関数**でサーバー・クライアント両方で利用可能。

```typescript
import { calculateAllIndicators } from '@/lib/calc';
import type { IndicatorResults } from '@/lib/types/calc';

// page.tsx (Server Component) で呼び出し
const result: IndicatorResults = calculateAllIndicators(financialData, parameters);
// result.period.theoryPrice.value → 470 (円)
// result.period.theoryPrice.metadata.formula → '現状理論株価 = ...'
```

**重要**: `financialData` は `FullFinancialDataRow[]` 型で、`calculateAllIndicators` 内部で `fiscal_year` 降順ソート済み。呼び出し側でのソートは不要。

### CalcResult<T> の構造

全指標は `CalcResult<number>` 型で返される（Story 4.6 の透明性パネルで活用予定）:
```typescript
type CalcResult<T> = {
  value: T | null;
  metadata: {
    formula: string;       // 数式文字列
    inputs: CalcInput[];   // 入力参照
    rounding: string;      // 端数処理ルール
    calcVersion: string;   // 'v1.0.0'
  };
};
```

**この Story では `value` のみ表示する。`metadata` は Story 4.6 (CalcLogicPanel) で使用するため、データは渡すが表示しない。**

### 指標カテゴリと PeriodIndicators のフィールドマッピング

| カテゴリ | フィールド名 | 表示名 | 単位 |
|---------|-------------|--------|------|
| 収益性 | `equityRatio` | 自己資本比率 | % |
| 収益性 | `netProfitMargin` | 純利益率 | % |
| 収益性 | `operatingMargin` | 売上営業利益率 | % |
| 成長性 | `revenueGrowthRate` | 売上高前年比成長率 | % |
| 成長性 | `netIncomeGrowthRate` | 純利益前年比成長率 | % |
| CF | `operatingCF` | 営業CF | 円 |
| CF | `investingCF` | 投資CF | 円 |
| CF | `fcf` | FCF | 円 |
| 資本効率 | `roe` | ROE | % |
| 資本効率 | `roa` | ROA | % |
| 資本効率 | `roic` | ROIC | % |
| 資本効率 | — (`movingAverageROIC`) | 移動平均ROIC | % |
| 株式指標 | `eps` | EPS | 円 |
| 株式指標 | `per` | PER | 倍 |
| 株式指標 | `pbr` | PBR | 倍 |
| 理論価値 | `businessValue` | 事業価値 | 円 |
| 理論価値 | `assetValue` | 資産価値 | 円 |
| 理論価値 | `theoryPrice` | 現状理論株価 | 円 |
| 理論価値 | `growthTheoryPrice` | 成長込理論株価 | 円 |
| 理論PER系 | `theoryMarketCap` | 理論時価総額 | 円 |
| 理論PER系 | `theoryPER` | 理論PER | 倍 |
| 理論PER系 | `futureTheoryMarketCap` | 5年後理論時価総額 | 円 |
| 理論PER系 | `futureNetIncome` | 6年目当期純利益 | 円 |
| 安全性 | `safetyMarginCurrent` | 安全域（現状） | 円 |
| 安全性 | `safetyMarginGrowth` | 安全域（成長込） | 円 |
| 安全性 | `safetyRateCurrent` | 安全率（現状） | % |
| 安全性 | `safetyRateGrowth` | 安全率（成長込） | % |
| 安全性 | `idealBuyPriceCurrent` | 理想購入株価（対現状） | 円 |
| 安全性 | `idealBuyPriceGrowth` | 理想購入株価（対成長） | 円 |

**注意**: `movingAverageROIC` は `result.movingAverageROIC` でアクセスする（`result.period` の外）。

### 金額表示ルール

大きな金額は人間が読みやすい単位に自動変換する:
- 1億円以上 → 「○○億円」（小数点以下1位まで）
- 1百万円以上 → 「○○百万円」（小数点以下1位まで）
- それ未満 → 「○○円」（整数）

既存の `formatAmount()` (financial-data-list.tsx) は百万円固定なので、**新しいフォーマッタを作成する**。

### タブ順序変更

UX仕様書のタブ順序: **概要 → 理論株価 → 財務データ → パラメータ**

現在の `stock-detail-tabs.tsx` のタブ: 概要 / 財務データ / パラメータ

「理論株価」タブを「概要」と「財務データ」の間に挿入する。URL パラメータは `?tab=theory-price` とする。

### 比較サマリーのバッジ判定ロジック

安全率（現状）に基づく視覚的バッジ:
- **割安**: 安全率 > 0%（理論株価 > 現在株価）→ 緑系
- **適正**: 安全率 = 0 付近（-10% ～ 0%）→ 黄系
- **割高**: 安全率 < -10%（現在株価 > 理論株価 × 1.1）→ 赤系

バッジは色 + テキストラベルの両方を表示（アクセシビリティ: 色のみに依存しない）。

### Project Structure Notes

新規ファイル:
- `src/components/stocks/theory-price-section.tsx` — メインコンポーネント（Client Component）
- `src/lib/format.ts` — 共通フォーマッタ（金額、パーセンテージ、倍率、null表示）

変更ファイル:
- `src/components/stocks/stock-detail-tabs.tsx` — タブ追加と順序変更
- `src/app/stocks/[id]/page.tsx` — `calculateAllIndicators()` 呼び出し追加

既存パターンとの整合:
- `ParameterSection` と同様の Client Component パターンを踏襲
- `FinancialDataSection` と同じ Props 受け渡しパターン（Server → Client）
- `stock-detail-tabs.tsx` のタブ管理は URL search params 連動済み（`?tab=` パラメータ）

### 既存コンポーネントからの再利用

- **`stock-detail-tabs.tsx`**: タブコンテナの追加パターンは既存の3タブ構成を踏襲
- **`financial-data-empty.tsx`**: Empty State の設計パターン（アイコン + メッセージ + ガイダンス）を参考にする
- **`ChangeRateLabel`** (financial-data-list.tsx): 符号付き色分け表示のパターンを参考にする（ただし直接の再利用は不要、新フォーマッタで対応）

### Story 4.6 との境界

**この Story の範囲**: 指標の値を表示するのみ。指標のクリックイベント、CalcLogicPanel の展開、metadata の表示は **Story 4.6 のスコープ**。

ただし、将来の CalcLogicPanel 統合に備えて:
- 各指標の値に `data-indicator` 属性を付与しておく（例: `data-indicator="theoryPrice"`）
- `CalcResult` オブジェクト全体を props として渡しておく（`value` のみでなく `metadata` も）

### Tailwind v3/v4 注意事項

プロジェクトは **Tailwind v3.4.1** を使用。shadcn/ui の最新コンポーネントは Tailwind v4 構文で出力されるため、以下の変換が必要:
- `w-(--var-name)` → `w-[var(--var-name)]`
- `has-data-[...]` → `has-[[data-...]`
- `in-data-[...]` → `[[data-...]_&]`

sidebar.tsx は修正済み（2026-03-25）。新しい shadcn/ui コンポーネントを追加する場合は構文を確認すること。

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.3]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — タブ構成、透明性パターン、CalcLogicPanel仕様]
- [Source: _bmad-output/planning-artifacts/prd.md — FR22, FR23, FR27-28, NFR1]
- [Source: _bmad-output/planning-artifacts/architecture.md — 計算エンジン設計、プロジェクト構造]
- [Source: src/lib/calc/index.ts — calculateAllIndicators()]
- [Source: src/lib/types/calc.ts — CalcResult<T>, PeriodIndicators, IndicatorResults]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- @testing-library/react が未導入のため、コンポーネントレンダリングテストはロジックテスト（getValuationLevel）＋フォーマッタユニットテストで代替
- 全222テストパス（新規24テスト含む）

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-25 | Story creation — ultimate context engine | Story 4.3 context engine |
| 2026-03-25 | Task 4: format.ts + format.test.ts 作成 | 共通フォーマッタ（億/百万/円、%、倍） |
| 2026-03-25 | Task 1-3: theory-price-section.tsx, タブ追加, page.tsx更新 | 理論株価ビューの全機能実装 |
| 2026-03-25 | Task 5-6: a11y対応 + テスト | aria-label, dl, バッジテスト |
| 2026-03-25 | Code review fix: M1-M4 | try-catch追加, 'use client'削除, formatCurrency境界修正, フォーマッタ小数桁制御 |

### File List

- `src/lib/format.ts` — 共通フォーマッタ（新規）
- `src/lib/format.test.ts` — フォーマッタテスト（新規、19テスト）
- `src/components/stocks/theory-price-section.tsx` — 理論株価セクション（新規）
- `src/components/stocks/theory-price-section.test.ts` — バッジロジックテスト（新規、5テスト）
- `src/components/stocks/stock-detail-tabs.tsx` — タブ追加（変更）
- `src/app/stocks/[id]/page.tsx` — calculateAllIndicators 呼び出し追加（変更）
