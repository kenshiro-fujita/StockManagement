/**
 * クライアントから戻ってくる EDINET 複合データの実行時検証を確認します。
 */
import { describe, expect, it } from 'vitest';
import {
  annualReportSchema,
  extractionSummarySchema,
  mappingChangesSchema,
  saveExtractedDataSchema,
} from '@/lib/schemas/edinet-actions';

const VALID_STOCK_ID = '550e8400-e29b-41d4-a716-446655440000';

const annualReport = {
  docID: 'S100AB12',
  secCode: '72030',
  edinetCode: 'E02144',
  filerName: 'テスト株式会社',
  periodStart: '2025-04-01',
  periodEnd: '2026-03-31',
  submitDateTime: '2026-06-25T09:00:00',
  docDescription: '有価証券報告書',
  xbrlFlag: true,
  csvFlag: true,
};

const extraction = {
  accountingStandard: 'JGAAP' as const,
  periodEnd: '2026-03-31',
  sourceType: 'csv' as const,
  results: [
    {
      metricKey: 'revenue' as const,
      label: '売上高',
      value: 1_000_000,
      matchedTag: 'NetSales',
      contextId: 'CurrentYearDuration',
      confidence: 'high' as const,
    },
  ],
};

describe('annualReportSchema', () => {
  it('正規の有価証券報告書メタデータを受け付ける', () => {
    expect(annualReportSchema.safeParse(annualReport).success).toBe(true);
  });

  it('書類IDへのパス文字混入を拒否する', () => {
    const result = annualReportSchema.safeParse({
      ...annualReport,
      docID: '../S100AB12',
    });
    expect(result.success).toBe(false);
  });
});

describe('extractionSummarySchema', () => {
  it('有限数の抽出結果を受け付ける', () => {
    expect(extractionSummarySchema.safeParse(extraction).success).toBe(true);
  });

  it('同じ指標キーの重複を拒否する', () => {
    const result = extractionSummarySchema.safeParse({
      ...extraction,
      results: [extraction.results[0], extraction.results[0]],
    });
    expect(result.success).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'DBへ保存できない非有限値 %s を拒否する',
    (value) => {
      const result = extractionSummarySchema.safeParse({
        ...extraction,
        results: [{ ...extraction.results[0], value }],
      });
      expect(result.success).toBe(false);
    }
  );
});

describe('EDINET保存・比較入力', () => {
  it('保存対象の銘柄・年度・区分をまとめて検証する', () => {
    const result = saveExtractedDataSchema.safeParse({
      stockId: VALID_STOCK_ID,
      extraction,
      fiscalYear: 2026,
      docId: 'S100AB12',
      fiscalQuarter: 'FY',
      consolidationType: 'consolidated',
    });
    expect(result.success).toBe(true);
  });

  it('任意文字列の四半期・連結区分を拒否する', () => {
    const result = saveExtractedDataSchema.safeParse({
      stockId: VALID_STOCK_ID,
      extraction,
      fiscalYear: 2026,
      docId: 'S100AB12',
      fiscalQuarter: 'annual',
      consolidationType: 'group',
    });
    expect(result.success).toBe(false);
  });

  it('マッピング比較でも既知の指標キーだけを受け付ける', () => {
    const result = mappingChangesSchema.safeParse({
      stockId: VALID_STOCK_ID,
      fiscalYear: 2026,
      currentResults: [{ metricKey: 'unknown_metric', matchedTag: null }],
    });
    expect(result.success).toBe(false);
  });
});
