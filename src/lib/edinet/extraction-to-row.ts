/**
 * EDINET 抽出結果 → financial_data カラムへの変換（単一の真実の源）
 *
 * MetricKey と DB カラム名は一部で名前が異なる
 * （operating_profit → operating_income、issued_shares → shares_outstanding 等）。
 * このマッピングが複数箇所にコピーされると、財務項目を1つ追加したときに
 * 取り込み経路（書類抽出 / マスタ取込）によってデータが欠けるサイレント不整合が起こる。
 * 変換は必ずこのモジュールを経由すること。
 */
import type { ExtractionSummary } from './extraction';
import type { MetricKey } from './taxonomy';

/** MetricKey → financial_data カラム名の対応表（保存対象のみ。eps_basic は保存しない） */
export const METRIC_TO_COLUMN = {
  revenue: 'revenue',
  operating_profit: 'operating_income',
  net_income_parent: 'net_income',
  total_assets: 'total_assets',
  equity: 'equity',
  interest_bearing_debt: 'interest_bearing_debt',
  operating_cf: 'operating_cf',
  investing_cf: 'investing_cf',
  issued_shares: 'shares_outstanding',
  interest_expense: 'interest_expense',
  cash_and_equivalents: 'cash_and_equivalents',
  current_assets: 'current_assets',
  investments_and_other_assets: 'investments_and_other_assets',
  current_liabilities: 'current_liabilities',
  non_current_liabilities: 'non_current_liabilities',
  shareholders_equity: 'shareholders_equity',
} as const satisfies Partial<Record<MetricKey, string>>;

/** financial_data に保存する財務カラム名の一覧（edinet_master とのコピーにも使う） */
export const FINANCIAL_COLUMNS = Object.values(METRIC_TO_COLUMN);

export type FinancialColumnValues = Record<
  (typeof METRIC_TO_COLUMN)[keyof typeof METRIC_TO_COLUMN],
  number | null
>;

/** 抽出結果から financial_data / edinet_master の財務カラム値を組み立てる */
export function extractionToFinancialColumns(
  extraction: ExtractionSummary,
): FinancialColumnValues {
  const byKey = new Map(extraction.results.map((r) => [r.metricKey, r.value]));

  const columns = {} as Record<string, number | null>;
  for (const [metricKey, column] of Object.entries(METRIC_TO_COLUMN)) {
    columns[column] = byKey.get(metricKey as MetricKey) ?? null;
  }
  return columns as FinancialColumnValues;
}
