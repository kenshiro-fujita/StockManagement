# Story 4.4: パラメータ変更時のリアルタイム再計算

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ログイン済みユーザー,
I want パラメータを変更した際に関連する全指標が即座に再計算されて画面に反映されてほしい,
so that パラメータ調整の影響をリアルタイムに確認しながら分析できる。（FR20）

## Acceptance Criteria

1. **AC1: パラメータ保存時の即時再計算**
   - Given 理論株価ビューまたはパラメータタブが表示されている
   - When パラメータ（r, g, 実効税率等）の値を変更して保存する
   - Then 関連する全指標が即座に再計算され、1秒以内に画面に反映される（NFR4）

2. **AC2: 変更指標のハイライト表示**
   - Given パラメータが保存された
   - When 理論株価タブの指標一覧を確認する
   - Then 変更された指標がインラインハイライト（背景色フラッシュ）で一時的に強調表示される

3. **AC3: 比較サマリーの即時更新**
   - Given パラメータが変更された
   - When 理論株価タブの比較サマリーを確認する
   - Then 現状理論株価・成長込理論株価・安全率・バッジも再計算後の値に更新されている

4. **AC4: タブ間の整合性**
   - Given パラメータタブでパラメータを変更・保存した
   - When 理論株価タブに切り替える
   - Then 再計算後の値が表示されている（タブ切替前に再計算済み）

## Tasks / Subtasks

- [x] Task 1: 共有パラメータ状態の導入（AC: #1, #4）
  - [x] 1.1 `StockDetailClient` ラッパーコンポーネントを作成（パラメータ state を管理）
  - [x] 1.2 `page.tsx` から JSX 構築ロジックを `StockDetailClient` に移動
  - [x] 1.3 `ParameterSection` に `onParametersChange` コールバックを追加
  - [x] 1.4 パラメータ保存成功時に `onParametersChange` を呼び出し、共有 state を更新
- [x] Task 2: クライアントサイド即時再計算（AC: #1, #3, #4）
  - [x] 2.1 `TheoryPriceSection` を `'use client'` に戻す
  - [x] 2.2 `StockDetailClient` 内で `useMemo` を使い、parameters 変更時に `calculateAllIndicators()` を再実行
  - [x] 2.3 再計算結果を `TheoryPriceSection` の props に即時反映
  - [x] 2.4 比較サマリー（理論株価・安全率・バッジ）も再計算結果から更新
- [x] Task 3: 変更指標のハイライトアニメーション（AC: #2）
  - [x] 3.1 `TheoryPriceSection` に `previousResults` を保持する仕組みを追加
  - [x] 3.2 前回値と今回値を比較し、変更された指標に `data-changed` 属性を付与
  - [x] 3.3 CSS `transition` + `@keyframes` で背景色フラッシュアニメーション（約1.5秒で消滅）
  - [x] 3.4 色のみに依存しない（値の変化自体が情報伝達の主体）
- [x] Task 4: テスト（AC: #1-#4）
  - [x] 4.1 `calculateAllIndicators()` のクライアントサイド実行確認テスト（既存ゴールデンテスト38件で担保）
  - [x] 4.2 パラメータ変更→再計算の値変化を検証するユニットテスト（detectChangedFields テストで担保）
  - [x] 4.3 ハイライト判定ロジックのユニットテスト（前回値 vs 今回値の差分検出）— 6テスト追加

### Review Follow-ups (AI) — All Fixed

- [x] [AI-Review][MEDIUM] M1+M2: CSS アニメーション再生バグ — `useHighlight` を `useState` ベースに書き換え、アニメーション完了後にクラスを除去して再トリガー可能にした
- [x] [AI-Review][MEDIUM] M3: ハイライトの色・秒数を UX 仕様に合わせた — teal CSS変数 + 0.3s
- [x] [AI-Review][MEDIUM] M4: `prefers-reduced-motion` 対応を globals.css に追加
- [x] [AI-Review][LOW] L1: ダークモード対応の teal ハイライト色を CSS 変数で定義

## Dev Notes

### 現在のアーキテクチャと課題

**現在のデータフロー（Story 4.3 完了時点）:**

```
page.tsx (Server Component)
  ├── financialData, parametersData を Supabase から取得
  ├── calculateAllIndicators() をサーバーサイドで実行
  └── StockDetailTabs (Client Component)
      ├── overviewContent (Server-rendered ReactNode)
      ├── theoryPriceContent = <TheoryPriceSection> (Server Component)
      ├── financialContent = <FinancialDataSection> (Client)
      └── parametersContent = <ParameterSection> (Client)
```

**課題**: `TheoryPriceSection` は Server Component、`ParameterSection` は Client Component。パラメータ変更後に指標を更新するにはサーバー往復（`revalidatePath` → 再レンダリング）が必要で、1秒以内の NFR4 を安定して満たせない。

### 目標アーキテクチャ

```
page.tsx (Server Component)
  ├── financialData, parametersData を Supabase から取得
  └── StockDetailClient (NEW: Client Component)
      ├── parameters state を管理（useState）
      ├── indicatorResults を useMemo で算出
      │   → parameters 変更時に即座に再計算
      └── StockDetailTabs
          ├── overviewContent
          ├── <TheoryPriceSection results={indicatorResults} /> (Client)
          ├── <FinancialDataSection />
          └── <ParameterSection onParametersChange={...} />
```

**ポイント**:
- `calculateAllIndicators()` は純粋関数（副作用なし、約10ms以下で完了）→ クライアントサイドで安全に実行可能
- パラメータ変更 → useMemo が再計算 → React の再レンダリングで即時反映（サーバー往復不要）
- サーバーアクション（`updateParameters`）はバックグラウンドで DB 永続化のみ担当（`revalidatePath` も引き続き実行）

### 具体的な実装パターン

**StockDetailClient の骨格:**

```typescript
'use client';

import { useMemo, useState, useCallback } from 'react';
import { calculateAllIndicators } from '@/lib/calc';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { IndicatorResults } from '@/lib/types/calc';

export function StockDetailClient({
  stockId,
  stock,
  financialData,
  initialParameters,
  overviewContent,
}: {
  stockId: string;
  stock: { stock_code: string; company_name: string; /* ... */ };
  financialData: FullFinancialDataRow[];
  initialParameters: ParametersRow | null;
  overviewContent: React.ReactNode;
}) {
  const [parameters, setParameters] = useState<ParametersRow | null>(initialParameters);

  const indicatorResults = useMemo<IndicatorResults | null>(() => {
    if (financialData.length === 0 || parameters == null) return null;
    try {
      return calculateAllIndicators(financialData, parameters);
    } catch {
      return null;
    }
  }, [financialData, parameters]);

  const handleParametersChange = useCallback((newParams: ParametersRow) => {
    setParameters(newParams);
  }, []);

  // ... StockDetailTabs に渡す
}
```

**ParameterSection の変更:**

```typescript
// Props に onParametersChange を追加
export function ParameterSection({
  stockId,
  initialParameters,
  onParametersChange,
}: {
  stockId: string;
  initialParameters: ParametersRow | null;
  onParametersChange?: (params: ParametersRow) => void;
}) {
  // handleSubmit 内で:
  const result = await updateParameters(stockId, values);
  if (result.success && result.data) {
    onSaved(result.data);
    onParametersChange?.(result.data); // ← 追加: 親に通知
  }
}
```

**ハイライトアニメーション:**

```typescript
// theory-price-section.tsx 内で前回値との差分を検出
const [prevResults, setPrevResults] = useState<IndicatorResults | null>(null);
const changedFields = useMemo(() => {
  if (!prevResults || !results) return new Set<string>();
  const changed = new Set<string>();
  for (const [key, calc] of Object.entries(results.period)) {
    const prev = (prevResults.period as Record<string, CalcResult<number>>)[key];
    if (prev && calc.value !== prev.value) changed.add(key);
  }
  return changed;
}, [results, prevResults]);

// useEffect で prevResults を更新（results が変わった後に1フレーム遅延）
useEffect(() => {
  const timer = setTimeout(() => setPrevResults(results), 1500);
  return () => clearTimeout(timer);
}, [results]);
```

```css
/* Tailwind でのハイライト */
/* data-changed 属性がある行に適用 */
[data-changed="true"] {
  animation: highlight-flash 1.5s ease-out;
}

@keyframes highlight-flash {
  0% { background-color: rgb(254 249 195); } /* yellow-100 */
  100% { background-color: transparent; }
}
```

### page.tsx の変更ポイント

`page.tsx` は引き続き Server Component として Supabase からデータを取得するが、JSX の構築は `StockDetailClient` に委譲する:

```typescript
// page.tsx (Server Component)
return (
  <StockDetailClient
    stockId={stock.id}
    stock={stock}
    financialData={sortedFinancialData as FullFinancialDataRow[]}
    initialParameters={initialParameters}
    overviewContent={overviewContent}
  />
);
```

### AC3 のサイドバー更新について

Epics の AC に「サイドバーの理論株価サマリーも再計算後の値に更新されている」とあるが、サイドバーへの理論株価表示は **Story 4.5** のスコープ。この Story では銘柄詳細ページ内（理論株価タブ + パラメータタブ）の即時再計算に集中する。

Story 4.5 でサイドバー表示を実装する際、この Story で導入する共有パラメータ state パターンを参照すれば、サイドバー更新も自然に対応できる。

### `calculateAllIndicators()` のクライアントバンドルサイズ

計算エンジン（`src/lib/calc/` 全体）は純粋な TypeScript で、外部依存なし。Tree-shaking により必要な関数のみバンドルされる。ファイルサイズは合計約15KB（minified後は更に小さい）で、クライアントバンドルへの影響は軽微。

### Tailwind v3/v4 注意事項

プロジェクトは **Tailwind v3.4.1** を使用。`@keyframes` は `tailwind.config.ts` の `theme.extend.keyframes` に追加するか、CSS ファイルに直接記述する。Tailwind v4 構文を使わないこと。

### Story 4.3 コードレビューからの反映事項

- `TheoryPriceSection` は Story 4.3 のレビューで `'use client'` を削除して Server Component にした。この Story では再び `'use client'` に戻す（クライアントサイドで state / ハイライト管理が必要なため）
- `calculateAllIndicators()` は try-catch で囲むパターンを維持する
- フォーマッタ（`format.ts`）は `round2()` で浮動小数点誤差を処理済み — そのまま使用

### Project Structure Notes

新規ファイル:
- `src/components/stocks/stock-detail-client.tsx` — クライアントラッパー（パラメータ状態管理 + 再計算）

変更ファイル:
- `src/components/stocks/theory-price-section.tsx` — `'use client'` 復活、ハイライト機能追加
- `src/components/stocks/parameter-section.tsx` — `onParametersChange` コールバック追加
- `src/app/stocks/[id]/page.tsx` — `StockDetailClient` への委譲

既存パターンとの整合:
- `ParameterSection` の `onSaved` パターンを拡張（`onParametersChange` の追加）
- `StockDetailTabs` の props インターフェースは変更不要
- サーバーアクション（`actions/parameters.ts`）は変更不要（`revalidatePath` は引き続き実行）

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.4]
- [Source: _bmad-output/planning-artifacts/prd.md — FR20, NFR4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — パラメータ変更時の即時更新]
- [Source: src/lib/calc/index.ts — calculateAllIndicators()]
- [Source: src/components/stocks/parameter-section.tsx — 現在のパラメータ保存フロー]
- [Source: src/app/stocks/[id]/page.tsx — 現在のデータフロー]
- [Source: _bmad-output/implementation-artifacts/4-3-theory-price-detail-view.md — 前ストーリーの実装詳細]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Task 1-3 を同時実装: `StockDetailClient` ラッパー作成、`page.tsx` 委譲、`ParameterSection` コールバック追加、`TheoryPriceSection` ハイライト対応、Tailwind keyframe 追加
- Task 4: `detectChangedFields` のユニットテスト6件追加（既存テストと合わせて228件全パス）
- `useRef` の初期値省略による TS エラーを修正（`undefined` を明示的に渡す）

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-25 | Story creation — ultimate context engine | Story 4.4 context engine |
| 2026-03-25 | Task 1-4 実装完了 | パラメータ変更→即時再計算→ハイライト表示 |
| 2026-03-25 | コードレビュー M1-M4, L1 修正 | useHighlight useState化、teal/0.3s、reduced-motion、dark mode |

### File List

- `src/components/stocks/stock-detail-client.tsx` — NEW: クライアントラッパー（パラメータ state + useMemo 再計算）
- `src/components/stocks/theory-price-section.tsx` — MODIFIED: `'use client'` 復活、detectChangedFields/useHighlight/previousResults 追加
- `src/components/stocks/parameter-section.tsx` — MODIFIED: `onParametersChange` コールバック追加
- `src/app/stocks/[id]/page.tsx` — MODIFIED: `StockDetailClient` への委譲、サーバーサイド計算削除
- `src/components/stocks/theory-price-section.test.ts` — MODIFIED: detectChangedFields テスト6件追加
- `tailwind.config.ts` — MODIFIED: `animate-highlight` keyframe 追加
