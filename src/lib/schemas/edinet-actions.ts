/**
 * EDINET Server Actions がクライアントから受け取る複合データを検証します。
 *
 * 抽出結果や検索結果は通常はサーバー生成ですが、Server Action の引数は直接 POST で
 * 改変できるため、DB へ保存する直前にも完全な構造と上限を検証します。
 */
import { z } from 'zod';
import { METRIC_KEYS } from '@/lib/edinet/extraction';
import type { AnnualReport } from '@/lib/edinet/types';
import type { ExtractionSummary } from '@/lib/edinet/extraction';
import type { MetricKey } from '@/lib/edinet/taxonomy';
import {
  edinetDocumentIdSchema,
  fiscalYearSchema,
  stockIdSchema,
} from '@/lib/schemas/common';
import {
  CONSOLIDATION_TYPE_OPTIONS,
  FISCAL_QUARTER_OPTIONS,
} from '@/lib/schemas/financial-data';

/** EDINET が返す日付または日時文字列の最大長です。 */
const DATE_TEXT_MAX_LENGTH = 64;
/** DB・ログへ保存する外部テキストの防御的な最大長です。 */
const EXTERNAL_TEXT_MAX_LENGTH = 2_000;

const nullableDateTextSchema = z.string().max(DATE_TEXT_MAX_LENGTH).nullable();

/** EDINET 検索結果として保存できる有価証券報告書メタデータです。 */
export const annualReportSchema: z.ZodType<AnnualReport> = z.object({
  docID: edinetDocumentIdSchema,
  secCode: z
    .string()
    .min(1)
    .max(16)
    .regex(/^[0-9A-Za-z]+$/),
  edinetCode: z.string().max(32).nullable(),
  filerName: z.string().min(1).max(500),
  periodStart: nullableDateTextSchema,
  periodEnd: nullableDateTextSchema,
  submitDateTime: nullableDateTextSchema,
  docDescription: z.string().max(EXTERNAL_TEXT_MAX_LENGTH).nullable(),
  xbrlFlag: z.boolean(),
  csvFlag: z.boolean(),
});

const metricKeySchema = z.enum(METRIC_KEYS as [MetricKey, ...MetricKey[]]);

/** 1指標分の抽出結果です。 */
const extractionResultSchema = z.object({
  metricKey: metricKeySchema,
  label: z.string().min(1).max(200),
  value: z.number().finite().nullable(),
  matchedTag: z.string().max(500).nullable(),
  contextId: z.string().max(1_000).nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});

/** financial_data と監査ログへ保存できる EDINET 抽出結果です。 */
export const extractionSummarySchema: z.ZodType<ExtractionSummary> = z.object({
  accountingStandard: z.enum(['JGAAP', 'IFRS', 'USGAAP']),
  periodEnd: nullableDateTextSchema,
  sourceType: z.enum(['csv', 'xbrl']),
  results: z
    .array(extractionResultSchema)
    .min(1)
    .max(METRIC_KEYS.length)
    .refine(
      (results) =>
        new Set(results.map((result) => result.metricKey)).size ===
        results.length,
      '指標キーが重複しています'
    ),
});

/** 書類メタデータ保存アクションの入力です。 */
export const saveEdinetDocumentSchema = z.object({
  stockId: stockIdSchema,
  report: annualReportSchema,
});

/** 抽出結果保存アクションの入力です。 */
export const saveExtractedDataSchema = z.object({
  stockId: stockIdSchema,
  extraction: extractionSummarySchema,
  fiscalYear: fiscalYearSchema,
  docId: edinetDocumentIdSchema,
  fiscalQuarter: z.enum(FISCAL_QUARTER_OPTIONS),
  consolidationType: z.enum(CONSOLIDATION_TYPE_OPTIONS),
});

/** 同一期間データの存在確認アクションの入力です。 */
export const existingFinancialDataSchema = z.object({
  stockId: stockIdSchema,
  fiscalYear: fiscalYearSchema,
  fiscalQuarter: z.enum(FISCAL_QUARTER_OPTIONS),
  consolidationType: z.enum(CONSOLIDATION_TYPE_OPTIONS),
});

/** 前年度とのタグマッピング比較アクションの入力です。 */
export const mappingChangesSchema = z.object({
  stockId: stockIdSchema,
  fiscalYear: fiscalYearSchema,
  currentResults: z
    .array(
      z.object({
        metricKey: metricKeySchema,
        matchedTag: z.string().max(500).nullable(),
      })
    )
    .max(METRIC_KEYS.length),
});
