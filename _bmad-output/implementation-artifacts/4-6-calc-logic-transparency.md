# Story 4.6: 計算ロジック透明性（CalcLogicPanel）

## Status: done

## 実装内容

### CalcLogicPanel コンポーネント
- 各指標値をクリックすると、インラインで CalcLogicPanel が展開される
- パネルには以下が表示される：
  - **数式**: 算出に使用された数式（formula）
  - **入力値**: 各入力の参照（ラベル、値、期間、ソース）
  - **端数処理**: 四捨五入ルール
  - **calc_version**: 計算ロジックのバージョン

### UI デザイン
- クリッカブル指標: ティール色テキスト + 点線下線 + ▼/▲ アイコン
- パネル: ティール系の薄い背景 + ボーダー
- 一度に1つのパネルのみ展開（トグル動作）
- パネル外クリックで閉じる

### アクセシビリティ
- `<button>` 要素でキーボード操作（Enter/Space）対応
- `aria-expanded` で展開状態を通知
- `aria-label` で操作ヒントを読み上げ
- `role="region"` でパネル領域をランドマーク化
- `focus-visible` でフォーカスリング表示

### 対象コンポーネント
- SummaryCard（比較セクションの理論株価・安全率）
- IndicatorSection（各カテゴリの全指標）

## ファイル変更
- `src/components/stocks/theory-price-section.tsx` — CalcLogicPanel, ClickableValue 追加、IndicatorSection・SummaryCard・ComparisonSummary にトグル機能追加
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — ステータス更新
