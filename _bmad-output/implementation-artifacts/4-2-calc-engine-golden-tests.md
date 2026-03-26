# Story 4.2: 計算エンジンの実装とゴールデンテスト

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 開発者,
I want 財務データとパラメータから全指標（ROE, PER, 理論株価等）を自動算出する計算エンジンを実装したい,
so that ユーザーに正確で検証済みの理論株価を提供できる。（FR21）

## Acceptance Criteria

1. **AC1: 全指標の自動算出**
   - Given `lib/calc/` に計算エンジンの純粋関数が実装されている
   - When 財務データ（`FullFinancialDataRow`）とパラメータ（`ParametersRow`）を入力として渡す
   - Then 以下の全指標が算出される：
     - **収益性**: 自己資本比率、純利益率、売上営業利益率
     - **成長性**: 前年比売上成長率、前年比利益成長率
     - **キャッシュフロー**: 営業CF、投資CF、FCF
     - **資本効率**: ROE、ROA、ROIC、移動平均ROIC
     - **株式指標**: PER、PBR、EPS
     - **理論価値**: 現状事業価値、現状資産価値、現状理論株価、成長込理論株価
     - **理論PER系**: 理論PER、理論時価総額、5年後理論時価総額、6年目当期純利益
     - **安全性**: 安全域（現状/成長込）、安全率（現状/成長込）、理想購入株価（対現状/対成長）

2. **AC2: 透明性メタデータの出力**
   - Given 計算エンジンが実装されている
   - When 各計算関数を実行する
   - Then 結果と一緒に透明性メタデータが返される：
     - 数式文字列（例: `事業価値 = 営業利益 × (1-実効税率) ÷ (r-g)`）
     - 入力参照（どの期のどのフィールドを使用したか）
     - 端数処理ルール（四捨五入/切捨て、桁数）
     - calc_version（`v1.0.0`）

3. **AC3: ゴールデンテスト合格**
   - Given ゴールデンテスト用データ（1銘柄×3期分）が用意されている
   - When Vitest でゴールデンテストを実行する
   - Then 既存スプレッドシートの計算結果と一致する
   - And 差分がある場合は端数処理・単位・期ズレ・入力マッピングのいずれかとして理由が明記される

4. **AC4: パフォーマンス**
   - Given 1銘柄あたりの計算が実行される
   - When 全指標を算出する
   - Then 3秒以内に完了する（NFR1）

## Tasks / Subtasks

- [x] Task 1: 計算結果の型定義と透明性メタデータの型設計 (AC: #1, #2)
  - [x]1.1 `src/lib/types/calc.ts` に `CalcResult<T>` 型を作成する（value + metadata）
  - [x]1.2 `CalcMetadata` 型を定義する：`formula` (string), `inputs` (配列: {label, value, period, field}), `rounding` (string), `calcVersion` (string)
  - [x]1.3 全指標の結果をまとめる `IndicatorResults` 型を定義する
  - [x]1.4 `CALC_VERSION = 'v1.0.0'` 定数を定義する

- [x] Task 2: 基本財務指標の計算関数実装 (AC: #1, #2)
  - [x]2.1 `src/lib/calc/ratios.ts` — 財務比率の計算関数を実装する：
    - `calcEquityRatio(equity, totalAssets)` → 自己資本比率 = 自己資本 ÷ 総資産 × 100（%）
    - `calcNetProfitMargin(netIncome, revenue)` → 純利益率 = 純利益 ÷ 売上高 × 100（%）
    - `calcOperatingMargin(operatingIncome, revenue)` → 売上営業利益率 = 営業利益 ÷ 売上高 × 100（%）
    - `calcROE(netIncome, equity)` → ROE = 純利益 ÷ 自己資本 × 100（%）
    - `calcROA(netIncome, totalAssets)` → ROA = 純利益 ÷ 総資産 × 100（%）
    - `calcROIC(operatingIncome, taxRate, equity, interestBearingDebt)` → ROIC = 営業利益 × (1-実効税率) ÷ (自己資本+有利子負債) × 100（%）
  - [x]2.2 各関数は `CalcResult<number>` を返す（透明性メタデータ付き）
  - [x]2.3 分母が0の場合は `null` を返す（ゼロ除算防止）
  - [x]2.4 ユニットテスト: `src/lib/calc/ratios.test.ts`

- [x] Task 3: 株式指標・CF指標の計算関数実装 (AC: #1, #2)
  - [x]3.1 `src/lib/calc/stock-metrics.ts` — 株式関連指標：
    - `calcEPS(netIncome, sharesOutstanding)` → EPS = 純利益 ÷ 発行済株式数（円）
    - `calcPER(currentStockPrice, eps)` → PER = 現在株価 ÷ EPS（倍）
    - `calcPBR(currentStockPrice, sharesOutstanding, equity)` → PBR = 現在株価 × 発行済株式数 ÷ 自己資本（倍）
    - `calcFCF(operatingCF, investingCF)` → FCF = 営業CF + 投資CF（円）
  - [x]3.2 `src/lib/calc/growth.ts` — 成長率計算（前年比）：
    - `calcYoYGrowthRate(current, previous)` → 前年比成長率 = (当期 - 前期) ÷ |前期| × 100（%）
    - `calcMovingAverageROIC(roicValues[])` → 移動平均ROIC = ROIC の n 期分平均
  - [x]3.3 各関数は `CalcResult<number>` を返す
  - [x]3.4 `sharesOutstanding` / `currentStockPrice` が null の場合は `null` を返す
  - [x]3.5 ユニットテスト: `src/lib/calc/stock-metrics.test.ts`, `src/lib/calc/growth.test.ts`

- [x] Task 4: 理論株価の計算関数実装（山口揚平氏の手法） (AC: #1, #2)
  - [x]4.1 `src/lib/calc/theory-price.ts` — 理論株価算出のコア関数：
    - `calcBusinessValue(operatingIncome, taxRate, discountRate, growthRate, capMultiplier)`:
      - 基本式: `事業価値 = 営業利益 × (1-実効税率) ÷ (r-g)`
      - 上限倍率適用: `min(基本式, 営業利益 × cap_multiplier × (1-実効税率))`
    - `calcAssetValue(equity)` → 現状資産価値 = 自己資本（株主資本）
    - `calcTheoryPrice(businessValue, assetValue, interestBearingDebt, sharesOutstanding)`:
      - `現状理論株価 = (事業価値 + 資産価値 - 有利子負債) ÷ 発行済株式数`
      - 円未満切捨て（`Math.floor`）
    - `calcGrowthTheoryPrice(...)` — 成長込理論株価（g を反映した計算）
    - `calcTheoryPER(theoryMarketCap, netIncome)` → 理論PER = 理論時価総額 ÷ 純利益
    - `calcTheoryMarketCap(theoryPrice, sharesOutstanding)` → 理論時価総額 = 理論株価 × 発行済株式数
    - `calcFutureTheoryMarketCap(theoryMarketCap, growthRate, years=5)` → 5年後理論時価総額
    - `calcFutureNetIncome(netIncome, growthRate, years=5)` → 6年目当期純利益 = 純利益 × (1+g)^5
  - [x]4.2 各関数は `CalcResult<number>` を返す
  - [x]4.3 ユニットテスト: `src/lib/calc/theory-price.test.ts`

- [x] Task 5: 安全域・理想購入株価の計算関数実装 (AC: #1, #2)
  - [x]5.1 `src/lib/calc/safety.ts` — 安全域・安全率の算出：
    - `calcSafetyMargin(theoryPrice, currentStockPrice)` → 安全域 = 理論株価 - 現在株価（円）
    - `calcSafetyRate(theoryPrice, currentStockPrice)` → 安全率 = (理論株価 - 現在株価) ÷ 理論株価 × 100（%）
    - `calcIdealBuyPrice(theoryPrice, discountFactor=0.5)` → 理想購入株価 = 理論株価 × 割引係数
    - 現状/成長込の2パターンをそれぞれ算出する
  - [x]5.2 `currentStockPrice` が null の場合は安全域/安全率は `null` を返す
  - [x]5.3 ユニットテスト: `src/lib/calc/safety.test.ts`

- [x] Task 6: 統合計算関数とゴールデンテストデータの作成 (AC: #1, #3)
  - [x]6.1 `src/lib/calc/index.ts` — 全指標を一括計算するエントリーポイント：
    - `calculateAllIndicators(financialData: FullFinancialDataRow[], parameters: ParametersRow): IndicatorResults`
    - 最新期のデータをメイン入力として使用する
    - 前期データがある場合は成長率計算に使用する
    - 移動平均ROICは全期間データを使用する
  - [x]6.2 `src/lib/calc/__fixtures__/golden-data.ts` — ゴールデンテストデータ：
    - 1銘柄×3期分の `FullFinancialDataRow` テストデータを作成する
    - 対応するパラメータ（`ParametersRow`）テストデータを作成する
    - 期待される計算結果（スプレッドシートの値）を記録する
    - 各期待値に根拠コメント（スプレッドシートのどのセルに対応するか）を付記する
  - [x]6.3 ゴールデンテスト: `src/lib/calc/golden.test.ts`
    - 3期分すべての指標の計算結果が期待値と一致することを検証する
    - 差分がある場合はテスト内のコメントで理由（端数処理/単位/期ズレ/入力マッピング）を明記する
  - [x]6.4 パフォーマンステスト: 全指標算出が3秒以内に完了することを検証する

- [x] Task 7: ビルド確認と全テスト通過 (AC: #1, #2, #3, #4)
  - [x]7.1 `npm test` で全テスト通過を確認する
  - [x]7.2 `npm run build` でビルド成功を確認する

## Dev Notes

### 計算エンジンのアーキテクチャ

**配置**: `src/lib/calc/` ディレクトリに純粋な TypeScript 関数として実装する
- サーバー/クライアントの両方で使用可能（Server Components での初回計算 + クライアントでのパラメータ変更時の即時再計算）
- **すべての入力値は「円」単位で渡される**（`toYen()` 変換済み）。計算エンジン内で単位変換は行わない

**ファイル構成**:
```
src/lib/calc/
├── index.ts              # エントリーポイント（calculateAllIndicators）
├── ratios.ts             # 財務比率（自己資本比率、ROE、ROA、ROIC 等）
├── stock-metrics.ts      # 株式指標（EPS、PER、PBR、FCF）
├── growth.ts             # 成長率計算（前年比、移動平均ROIC）
├── theory-price.ts       # 理論株価（事業価値、資産価値、理論株価、理論PER 等）
├── safety.ts             # 安全域・安全率・理想購入株価
├── types.ts              # CalcResult<T>、CalcMetadata、IndicatorResults 型（※ src/lib/types/calc.ts に配置）
├── __fixtures__/
│   └── golden-data.ts    # ゴールデンテスト用データ（1銘柄×3期分）
├── ratios.test.ts
├── stock-metrics.test.ts
├── growth.test.ts
├── theory-price.test.ts
├── safety.test.ts
└── golden.test.ts        # ゴールデンテスト
```

### 理論株価の計算式（山口揚平氏の手法）

UX モックアップから確認された計算式：

```
■ 事業価値
  基本式: 事業価値 = 営業利益 × (1 - 実効税率) ÷ (r - g)
  上限倍率適用: min(基本式, 営業利益 × cap_multiplier × (1 - 実効税率))

  例: 営業利益 = 3,380,000百万円, 実効税率 = 30%, r = 8%, g = 2%
  基本式: 3,380,000M × 0.70 ÷ (0.08 - 0.02) = 39,433,333M
  上限倍率: 3,380,000M × 10 × 0.70 = 23,660,000M
  → min(39,433,333M, 23,660,000M) = 23,660,000M（上限倍率適用）

■ 資産価値 = 自己資本（株主資本）

■ 現状理論株価
  理論株価 = (事業価値 + 資産価値 - 有利子負債) ÷ 発行済株式数
  = (23,660,000M + 8,120,000M - 2,000,000M) ÷ 10,000,000株
  = 2,978,000,000 ÷ 10,000,000 = ¥2,847（円未満切捨て）

■ 成長込理論株価
  成長込の事業価値を使用（g をフルに反映した計算）

■ 理論PER = 理論時価総額 ÷ 純利益
■ 理論時価総額 = 理論株価 × 発行済株式数
■ 5年後理論時価総額 = 理論時価総額 × (1 + g)^5
■ 6年目当期純利益 = 純利益 × (1 + g)^5

■ 安全域 = 理論株価 - 現在株価
■ 安全率 = (理論株価 - 現在株価) ÷ 理論株価 × 100
■ 理想購入株価（対現状） = 現状理論株価 × 0.5（半値）
■ 理想購入株価（対成長） = 成長込理論株価 × 0.5（半値）
```

### 透明性メタデータの設計

```typescript
type CalcMetadata = {
  formula: string;        // 数式文字列（例: '自己資本比率 = 自己資本 ÷ 総資産 × 100'）
  inputs: CalcInput[];    // 入力値の参照リスト
  rounding: string;       // 端数処理ルール（例: '小数点以下第2位を四捨五入'）
  calcVersion: string;    // calc_version（'v1.0.0'）
};

type CalcInput = {
  label: string;          // 入力値のラベル（例: '自己資本'）
  value: number;          // 使用した値
  field: string;          // DB フィールド名（例: 'equity'）
  period?: string;        // 期間（例: '2024年度 連結'）
  source?: string;        // データソース（'手動入力' | 'EDINET' | '算出値'）
};

type CalcResult<T> = {
  value: T | null;        // 計算結果（ゼロ除算等で算出不可の場合は null）
  metadata: CalcMetadata;
};
```

### 入力データの型（既存）

**FullFinancialDataRow** (`src/lib/types/financial-data.ts`):
- `revenue` (売上高), `operating_income` (営業利益), `net_income` (純利益)
- `total_assets` (総資産), `equity` (自己資本), `interest_bearing_debt` (有利子負債 | null)
- `operating_cf` (営業CF | null), `investing_cf` (投資CF | null)
- `shares_outstanding` (発行済株式数 | null), `interest_expense` (利息費用 | null)
- `current_stock_price` (現在株価 | null)
- `fiscal_year`, `fiscal_quarter`, `consolidation_type`, `input_unit`
- **すべての金額値は円で保存済み**

**ParametersRow** (`src/lib/types/parameters.ts`):
- `discount_rate` (割引率 r), `growth_rate` (成長率 g)
- `tax_rate` (実効税率), `cap_multiplier` (上限倍率)

### ゴールデンテストデータの設計

1銘柄×3期分のテストデータを作成する。ユーザーの既存スプレッドシートの計算ロジック（山口揚平氏の手法）に基づく。

**テストデータ要件**:
- 3期分の財務データ（年度、連結）
- パラメータ（デフォルト値: r=8%, g=2%, 実効税率=30%, 上限倍率=10）
- 各期の期待される計算結果一覧（20以上の指標）
- 端数処理の一貫性検証

**注意**: ゴールデンテストデータは、ユーザーが実際のスプレッドシートデータを提供するまでは、UX モックアップの計算例をベースに合理的なサンプルデータを作成する。将来的にスプレッドシートの実データで置き換える前提で、テストフレームワークを設計する。

### 端数処理ルール

- **パーセンテージ指標**（自己資本比率、ROE 等）: 小数点以下第2位を四捨五入（例: 15.23%）
- **理論株価**: 円未満切捨て（`Math.floor`）— UX モックアップで確認済み
- **EPS**: 小数点以下第2位を四捨五入
- **PER/PBR**: 小数点以下第2位を四捨五入
- **金額（事業価値等）**: 円未満四捨五入（`Math.round`）

### ゼロ除算・null 入力の処理

- `sharesOutstanding` が null → EPS, PER, PBR, 理論株価 は `null`
- `currentStockPrice` が null → PER, PBR, 安全域, 安全率 は `null`
- `interestBearingDebt` が null → 有利子負債 = 0 として計算（保守的でない方向）
- `operatingCF` / `investingCF` が null → FCF は `null`
- 分母が 0 → 結果は `null`

### 確立されたコードパターン（Story 4.1 から継承）

- **テストフレームワーク**: Vitest (`import { describe, it, expect } from 'vitest'`)
- **型定義**: `src/lib/types/` に共有型を配置
- **ファイル命名**: ケバブケース
- **パラメータ型**: `ParametersRow` — Story 4.1 で定義済み
- **パラメータデフォルト値**: `PARAMETER_DEFAULTS` — Story 4.1 で定義済み
- **calc_version**: Story 4.6（CalcLogicPanel）で UI 表示される予定

### Story 4.1 からの学び

- Zod v4 では `z.uuid()` を使用する（`z.string().uuid()` ではない）
- Supabase の NUMERIC 型は string として返る — `Number()` 変換が必要
- テストの UUID は RFC4122 準拠の形式を使用する（variant bit `[89ab]`）
- `displayMultiplier` パターンで内部値と表示値の変換を管理する

### Project Structure Notes

- `src/lib/types/calc.ts` — NEW: CalcResult<T>, CalcMetadata, CalcInput, IndicatorResults 型
- `src/lib/calc/index.ts` — NEW: calculateAllIndicators エントリーポイント
- `src/lib/calc/ratios.ts` — NEW: 財務比率の計算関数
- `src/lib/calc/stock-metrics.ts` — NEW: 株式指標の計算関数
- `src/lib/calc/growth.ts` — NEW: 成長率の計算関数
- `src/lib/calc/theory-price.ts` — NEW: 理論株価の計算関数
- `src/lib/calc/safety.ts` — NEW: 安全域・安全率の計算関数
- `src/lib/calc/__fixtures__/golden-data.ts` — NEW: ゴールデンテストデータ
- `src/lib/calc/*.test.ts` — NEW: 各計算関数のユニットテスト + ゴールデンテスト
- 既存ファイルの変更なし（計算エンジンは完全に新規コード）

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.2, FR21（全指標自動算出）]
- [Source: _bmad-output/planning-artifacts/prd.md — FR21（指標一覧）, NFR1（3秒以内）, NFR4（再計算1秒以内）, データ正確性（スプレッドシート一致）]
- [Source: _bmad-output/planning-artifacts/architecture.md — 計算エンジン配置（lib/calc/）、純粋関数設計、透明性メタデータ、ゴールデンテスト]
- [Source: _bmad-output/planning-artifacts/ux-design-directions.html — 理論株価計算式の実例（事業価値、上限倍率適用、円未満切捨て）]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — CalcLogicPanel 統一構造、透明性パターン]
- [Source: _bmad-output/implementation-artifacts/4-1-parameter-settings.md — ParametersRow 型、PARAMETER_DEFAULTS、displayMultiplier パターン]
- [Source: CLAUDE.md — 計算エンジンのゴールデンテスト要件、端数処理・単位・期ズレの検証]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

（なし）

### Completion Notes List

- `CalcResult<T>`, `CalcMetadata`, `CalcInput`, `PeriodIndicators`, `IndicatorResults` 型を `src/lib/types/calc.ts` に定義
- `CALC_VERSION = 'v1.0.0'` 定数を定義
- 財務比率計算関数（6関数）を `ratios.ts` に実装 — 16テスト通過
- 株式指標計算関数（4関数）を `stock-metrics.ts` に実装 — 17テスト通過
- 成長率計算関数（2関数）を `growth.ts` に実装 — 10テスト通過
- 理論株価計算関数（8関数）を `theory-price.ts` に実装 — 22テスト通過
  - 事業価値の上限倍率適用ロジック（`min(DCF式, 営業利益×cap×(1-t))`）
  - 現状理論株価の円未満切捨て（`Math.floor`）
  - 成長込理論株価（DCF式のみ、上限倍率なし）
- 安全域・安全率・理想購入株価（3関数）を `safety.ts` に実装 — 12テスト通過
- `calculateAllIndicators` 統合関数を `index.ts` に実装（28指標 + 移動平均ROIC）
- ゴールデンテストデータ（1銘柄×3期分）を `__fixtures__/golden-data.ts` に作成
- ゴールデンテスト（38テスト）全通過 — 収益性・成長性・CF・資本効率・株式指標・理論価値・安全性すべて期待値と一致
- パフォーマンステスト: 1000回実行が3秒以内に完了
- 全テスト198通過、ビルド成功

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-25 | Story creation — ultimate context engine | Story 4.2 context engine |
| 2026-03-25 | Implementation complete — all tasks done | Story 4.2 計算エンジン実装完了 |
| 2026-03-25 | Code review fixes (M1-M4) applied | 重複ユーティリティ抽出, non-null assertion除去, ソート検証追加, .gitkeep削除 |

### File List

- `src/lib/types/calc.ts` — NEW: CalcResult<T>, CalcMetadata, CalcInput, PeriodIndicators, IndicatorResults 型, CALC_VERSION 定数
- `src/lib/calc/ratios.ts` — NEW: 財務比率計算関数（自己資本比率, 純利益率, 営業利益率, ROE, ROA, ROIC）
- `src/lib/calc/ratios.test.ts` — NEW: 16テスト
- `src/lib/calc/stock-metrics.ts` — NEW: 株式指標計算関数（EPS, PER, PBR, FCF）
- `src/lib/calc/stock-metrics.test.ts` — NEW: 17テスト
- `src/lib/calc/growth.ts` — NEW: 成長率計算関数（前年比成長率, 移動平均ROIC）
- `src/lib/calc/growth.test.ts` — NEW: 10テスト
- `src/lib/calc/theory-price.ts` — NEW: 理論株価計算関数（事業価値, 資産価値, 理論株価, 成長込理論株価, 理論PER, 理論時価総額, 将来値）
- `src/lib/calc/theory-price.test.ts` — NEW: 22テスト
- `src/lib/calc/safety.ts` — NEW: 安全域・安全率・理想購入株価計算関数
- `src/lib/calc/safety.test.ts` — NEW: 12テスト
- `src/lib/calc/index.ts` — NEW: calculateAllIndicators 統合関数
- `src/lib/calc/__fixtures__/golden-data.ts` — NEW: ゴールデンテストデータ（1銘柄×3期分 + 期待値）
- `src/lib/calc/golden.test.ts` — NEW: ゴールデンテスト38テスト（全指標 + エッジケース + パフォーマンス）
- `src/lib/calc/utils.ts` — NEW: 共通端数処理ユーティリティ（roundPercent）
