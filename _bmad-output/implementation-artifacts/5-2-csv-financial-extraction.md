# Story 5.2: CSV (type=5) による財務データ抽出

Status: ready-for-dev

## Story

As a ログイン済みユーザー,
I want EDINET の有価証券報告書から主要財務項目を自動抽出してほしい,
so that 手動で数値を入力する手間が省け、正確な財務データを素早く分析に活用できる。（FR13, FR30）

## Acceptance Criteria

1. **Given** 保存済みの EDINET 書類（csvFlag=1）がある **When** 「データ取得」ボタンを押す **Then** CSV (type=5) がダウンロードされ、主要財務項目が抽出される
2. **Given** CSV データが抽出されている **When** 抽出結果を確認する **Then** 売上高、営業利益、純利益、総資産、自己資本、営業CF、投資CF、発行済株式数が表示される
3. **Given** 抽出が完了した **When** 「財務データに反映」を押す **Then** financial_data テーブルに自動保存される
4. **Given** 会計基準が異なる企業のCSVを処理する **When** J-GAAP/IFRS のタグが混在する **Then** 会計基準を自動判定し、適切なタグで値を抽出する
5. **Given** CSV に該当するタグが見つからない **When** 特定の財務項目が抽出できない **Then** null として扱い、ユーザーに手動入力を促す

## Tasks / Subtasks

- [ ] Task 1: 勘定科目マッピング定義
  - [ ] `src/lib/edinet/taxonomy.ts` — MetricKey 型、会計基準別タグ候補配列（METRIC_TAGS）
  - [ ] 対象: revenue, operating_profit, net_income_parent, total_assets, equity, operating_cf, investing_cf, issued_shares, interest_bearing_debt, interest_expense

- [ ] Task 2: CSV パーサー
  - [ ] `src/lib/edinet/csv-parser.ts` — ZIP展開 → UTF-16LE TSV デコード → Fact 配列抽出
  - [ ] 会計基準判定（AccountingStandardsDEI）
  - [ ] 連結/単体・当期判定（contextRef 解析）
  - [ ] 優先順位付きフォールバック検索で値抽出

- [ ] Task 3: 抽出結果の Server Action
  - [ ] `src/actions/edinet.ts` に extractFinancialData 追加 — docID で CSV 取得 → パース → 抽出結果返却
  - [ ] `src/actions/edinet.ts` に saveExtractedData 追加 — 抽出結果を financial_data に保存

- [ ] Task 4: 抽出UI
  - [ ] edinet-search.tsx に「データ取得」ボタンと抽出結果プレビュー追加
  - [ ] 抽出値の確認テーブル（項目名、抽出値、タグ名）
  - [ ] 「財務データに反映」ボタン

- [ ] Task 5: テスト
  - [ ] タクソノミマッピングのテスト
  - [ ] CSV パース・値抽出のテスト（モック TSV データ）

## Dev Notes

### CSV (type=5) の形式

- ZIP 内の `XBRL_TO_CSV/` フォルダに CSV ファイルが格納される
- **文字コード: UTF-16LE**（iconv-lite でデコードが必要）
- **区切り文字: タブ**（TSV 形式）
- ファイル名パターン: `jpcrp_....csv` 等
- 列構造: 要素名、項目名（日本語）、コンテキストID、ユニットID、値 等

### 会計基準判定

`jpdei_cor:AccountingStandardsDEI` タグの値で判定:
- "Japan GAAP" → J-GAAP
- 含む "ifrs" → IFRS
- 含む "us" → US-GAAP

### タグマッピング戦略（edinet-mcp 参考）

```typescript
const METRIC_TAGS = {
  revenue: {
    JGAAP: ["NetSales"],
    IFRS: ["Revenue", "SalesRevenues", "TotalNetRevenues", "OperatingRevenues"],
  },
  // ...
};
```

優先順位付きフォールバック: 配列の先頭から検索し、最初にヒットした値を採用する。
ローカル名（コロン以降）で照合し、名前空間プレフィックスは無視する。

### 有利子負債の合算

単一タグがないため、以下を合算:
- ShortTermLoansPayable
- CurrentPortionOfLongTermLoansPayable
- LongTermLoansPayable
- BondsPayable

### ライブラリ

- `jszip` — ZIP 展開（既存依存なし、新規追加）
- `iconv-lite` — UTF-16LE デコード

### References

- [Source: _bmad-output/planning-artifacts/research/ — 3LLM統合リサーチ]
- [Source: ChatGPT レポート — CSV UTF-16LE + TSV、taxonomy TypeScript型]

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
