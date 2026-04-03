# Story 7.1: 複数銘柄の横並び比較ビュー

Status: done

## Story

As a ログイン済みユーザー,
I want 複数の銘柄を横並びに比較したい,
so that 各銘柄の財務指標・理論株価・安全率を並べて見比べ、投資判断に活用できる。（FR24）

## Acceptance Criteria

1. **Given** 銘柄一覧ページにいる **When** 比較したい銘柄をチェックボックスで選択し「比較」ボタンを押す **Then** 比較ページ（/stocks/compare）に遷移し、選択銘柄が横並びで表示される
2. **Given** 比較ページが表示されている **When** 指標を確認する **Then** 各銘柄の主要指標（理論株価、安全率、ROE、PER、自己資本比率等）が列ごとに表示される
3. **Given** 比較ページが表示されている **When** 指標の値を確認する **Then** カテゴリ内で最良値がハイライト表示される
4. **Given** 比較ページが表示されている **When** 銘柄を追加/削除したい **Then** 比較対象を変更できる
5. **Given** 銘柄が1つも選択されていない **When** 比較ページにアクセスする **Then** 「銘柄を選択してください」のガイダンスが表示される
6. **Given** 比較テーブルが表示されている **When** キーボードで操作する **Then** テーブル内のすべてのインタラクティブ要素にアクセスできる

## Tasks / Subtasks

- [x] Task 1: 銘柄一覧に選択UI追加
  - [x] StockTable にチェックボックス列を追加
  - [x] 選択状態の管理（Client Component への変更）
  - [x] 「比較」ボタン（選択数表示付き、2件以上で有効化）

- [x] Task 2: 比較ページの作成
  - [x] `src/app/stocks/compare/page.tsx` — クエリパラメータから銘柄ID取得、データ取得、指標計算
  - [x] 比較テーブルコンポーネント — 行=指標、列=銘柄の横並び表示
  - [x] 最良値ハイライト（各指標カテゴリで最も良い値を強調）
  - [x] 空状態のガイダンス表示

- [x] Task 3: 比較対象の管理
  - [x] 比較ページから銘柄を削除する機能（Xボタン付き）
  - [x] 銘柄一覧へ戻って追加するリンク

- [x] Task 4: テスト
  - [x] 最良値ハイライトロジックのテスト（10テスト）

## Dev Notes

### URL設計

比較ページは `/stocks/compare?ids=uuid1,uuid2,uuid3` のクエリパラメータ形式。
ブックマーク可能、URLコピーで共有可能。

### 比較テーブル構造

```
| 指標           | 銘柄A     | 銘柄B     | 銘柄C     |
|---------------|----------|----------|----------|
| 銘柄コード     | 7203     | 6758     | 9984     |
| ロースター     | コア保有   | 成長枠    | 様子見    |
| 理論株価       | ¥2,345   | ¥5,678★  | ¥1,234   |
| 安全率（現状）  | +15.3%★  | -3.2%    | -12.5%   |
| ROE           | 12.3%★   | 8.5%     | 10.1%    |
| ...           | ...      | ...      | ...      |
```

★ = 最良値ハイライト

### 最良値の判定ロジック

- 高いほうが良い指標: ROE, ROA, ROIC, 自己資本比率, 純利益率, 営業利益率, 安全率, EPS
- 低いほうが良い指標: PER, PBR
- 比較不可: 理論株価, 事業価値（銘柄固有のため比較に意味がない → ハイライトなし）

### 表示する指標リスト

比較テーブルに表示する指標（theory-price-section.tsx の CATEGORIES を参考）:
- 基本情報: 銘柄コード, 企業名, ロースター
- 理論株価系: 現状理論株価, 成長込理論株価, 安全率（現状）, 安全率（成長込）
- 収益性: 自己資本比率, 純利益率, 営業利益率
- 資本効率: ROE, ROA, ROIC, 移動平均ROIC
- 株式指標: EPS, PER, PBR
- キャッシュフロー: 営業CF, 投資CF, FCF

### 銘柄一覧のClient Component化

StockTable は現在 Server Component。チェックボックスの状態管理のため、選択機能を追加する薄いクライアントラッパーが必要:

```
StocksPage (Server) → StockListClient (Client) → StockTable (Server→Client化)
```

または、StockTable をそのまま Client Component にして、既存のProps（stocks配列）はサーバーで計算済みなので問題ない。

### Project Structure Notes

- `src/app/stocks/compare/page.tsx` — 新規（比較ページ）
- `src/components/stocks/comparison-table.tsx` — 新規（比較テーブル）
- `src/components/stocks/stock-table.tsx` — チェックボックス追加、Client Component化
- `src/app/stocks/page.tsx` — StockTable ラッパー調整

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, FR24]
- [Source: src/components/stocks/theory-price-section.tsx — CATEGORIES 定義、指標フォーマット]
- [Source: src/lib/calc/index.ts — calculateAllIndicators]
