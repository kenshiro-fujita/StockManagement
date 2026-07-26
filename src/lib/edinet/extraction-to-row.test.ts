/**
 * EDINET の抽出キーと保存カラムの境界を固定する。
 *
 * この対応がずれるとエラーにならず別カラムが null のまま保存されるため、
 * 値・欠損・保存対象外メトリックをまとめて回帰テストする。
 */
import { describe, expect, it } from 'vitest';
import type { ExtractionResult, ExtractionSummary } from './extraction';
import {
  extractionToFinancialColumns,
  FINANCIAL_COLUMNS,
} from './extraction-to-row';
import type { MetricKey } from './taxonomy';

/** 必要な差分だけ指定して、1件の抽出結果を作る。 */
function extractionResult(
  metricKey: MetricKey,
  value: number | null
): ExtractionResult {
  return {
    metricKey,
    label: metricKey,
    value,
    matchedTag: value == null ? null : metricKey,
    contextId: value == null ? null : 'CurrentYearDuration',
    confidence: value == null ? 'low' : 'high',
  };
}

describe('extractionToFinancialColumns', () => {
  it('MetricKey を対応する financial_data カラムへ変換する', () => {
    const extraction: ExtractionSummary = {
      accountingStandard: 'JGAAP',
      periodEnd: '2025-03-31',
      sourceType: 'csv',
      results: [
        extractionResult('revenue', 10_000),
        extractionResult('operating_profit', 2_000),
        extractionResult('net_income_parent', 1_000),
        extractionResult('issued_shares', 500),
      ],
    };

    const columns = extractionToFinancialColumns(extraction);

    expect(columns.revenue).toBe(10_000);
    expect(columns.operating_income).toBe(2_000);
    expect(columns.net_income).toBe(1_000);
    expect(columns.shares_outstanding).toBe(500);
  });

  it('未抽出の保存対象カラムをすべて null で補完する', () => {
    const extraction: ExtractionSummary = {
      accountingStandard: 'JGAAP',
      periodEnd: null,
      sourceType: 'xbrl',
      results: [extractionResult('revenue', 10_000)],
    };

    const columns = extractionToFinancialColumns(extraction);

    expect(Object.keys(columns)).toEqual(FINANCIAL_COLUMNS);
    expect(columns.revenue).toBe(10_000);
    expect(columns.total_assets).toBeNull();
    expect(columns.shareholders_equity).toBeNull();
  });

  it('保存対象外の EPS は financial_data の列へ混入させない', () => {
    const extraction: ExtractionSummary = {
      accountingStandard: 'JGAAP',
      periodEnd: null,
      sourceType: 'csv',
      results: [extractionResult('eps_basic', 123.45)],
    };

    const columns = extractionToFinancialColumns(extraction);

    expect(Object.hasOwn(columns, 'eps_basic')).toBe(false);
    expect(Object.hasOwn(columns, 'eps')).toBe(false);
  });
});
