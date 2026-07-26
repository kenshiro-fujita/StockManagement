/**
 * EDINET 関連の Server Actions
 *
 * Next.js Server Actions として動作し、以下の操作を提供する:
 * - searchEdinetDocuments: 証券コードで有価証券報告書を検索する
 * - saveEdinetDocument: 検索結果の書類メタデータを DB に保存する
 * - extractFinancialData: CSV/XBRL から財務指標を抽出する（CSV優先→XBRLフォールバック）
 * - checkExistingFinancialData: 同じ年度のデータが既に存在するか確認する
 * - saveExtractedData: 抽出結果を financial_data テーブルに保存 + 抽出ログ記録
 * - checkMappingChanges: 前期の抽出ログと比較してタグ変更を検出する
 */
'use server';

import { getAuthenticatedContext } from '@/lib/supabase/auth';
import { checkStockOwnership, findOwnedStock } from '@/lib/supabase/ownership';
import { revalidateStockPaths } from '@/lib/revalidate';
import { searchAnnualReports, fetchDocumentData } from '@/lib/edinet/client';
import { resolveEdinetApiKey } from '@/lib/edinet/api-key';
import { validateDateRange } from '@/lib/edinet/date-range';
import { extractionToFinancialColumns } from '@/lib/edinet/extraction-to-row';
import {
  extractFinancialMetrics,
  type ExtractionSummary,
} from '@/lib/edinet/csv-parser';
import { extractFinancialMetricsFromXbrl } from '@/lib/edinet/xbrl-parser';
import type { AnnualReport } from '@/lib/edinet/types';
import type { TablesInsert } from '@/lib/types/database';
import type { ActionResult } from '@/lib/types/action';
import {
  edinetDocumentIdSchema,
  fourDigitStockCodeSchema,
} from '@/lib/schemas/common';
import {
  existingFinancialDataSchema,
  mappingChangesSchema,
  saveEdinetDocumentSchema,
  saveExtractedDataSchema,
} from '@/lib/schemas/edinet-actions';
import { matchesStockCode } from '@/actions/_internal/edinet';

/** 証券コードと日付範囲を指定して EDINET から有価証券報告書を検索する */
export async function searchEdinetDocuments(
  stockCode: string,
  startDate: string,
  endDate: string
): Promise<ActionResult<AnnualReport[]>> {
  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }

  // 入力検証（証券コードは4桁、日付範囲は最大6か月）
  if (!fourDigitStockCodeSchema.safeParse(stockCode).success) {
    return { success: false, error: '証券コードは4桁の数字で入力してください' };
  }
  const range = validateDateRange(startDate, endDate);
  if (!range.ok) {
    return { success: false, error: range.error };
  }

  try {
    // キーはリクエストごとに解決する（モジュールキャッシュ禁止 — api-key.ts 参照）
    const apiKey = await resolveEdinetApiKey();
    const reports = await searchAnnualReports(
      stockCode,
      startDate,
      endDate,
      apiKey
    );

    if (reports.length === 0) {
      return { success: true, data: [] };
    }

    return { success: true, data: reports };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'EDINET APIへの接続に失敗しました';
    return { success: false, error: message };
  }
}

/** 検索結果の書類メタデータを edinet_documents テーブルに保存する（upsert） */
export async function saveEdinetDocument(
  stockId: string,
  report: AnnualReport
): Promise<ActionResult> {
  const parsed = saveEdinetDocumentSchema.safeParse({ stockId, report });
  if (!parsed.success) {
    return { success: false, error: '書類情報が不正です' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase, user } = context;

  const ownership = await findOwnedStock(
    supabase,
    user.id,
    parsed.data.stockId
  );
  if (ownership.status === 'error') {
    return { success: false, error: '銘柄情報の確認に失敗しました' };
  }
  if (ownership.status === 'not_found') {
    return { success: false, error: '対象の銘柄が見つかりません' };
  }
  if (
    !matchesStockCode(ownership.stock.stock_code, parsed.data.report.secCode)
  ) {
    return {
      success: false,
      error: '書類の証券コードが対象銘柄と一致しません',
    };
  }

  const { error } = await supabase.from('edinet_documents').upsert(
    {
      user_id: user.id,
      stock_id: parsed.data.stockId,
      doc_id: parsed.data.report.docID,
      sec_code: parsed.data.report.secCode,
      edinet_code: parsed.data.report.edinetCode,
      filer_name: parsed.data.report.filerName,
      doc_type_code: '120',
      doc_description: parsed.data.report.docDescription,
      file_date:
        parsed.data.report.submitDateTime?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      period_start: parsed.data.report.periodStart,
      period_end: parsed.data.report.periodEnd,
      xbrl_flag: parsed.data.report.xbrlFlag ? '1' : '0',
      csv_flag: parsed.data.report.csvFlag ? '1' : '0',
      status: 'pending',
    },
    { onConflict: 'user_id,doc_id' }
  );

  if (error) {
    return { success: false, error: '書類情報の保存に失敗しました' };
  }

  revalidateStockPaths(parsed.data.stockId);
  return { success: true };
}

/**
 * EDINET の書類データから財務指標を抽出する
 *
 * 抽出戦略（CSV優先 → XBRLフォールバック）:
 * 1. csvFlag=true の場合、まず type=5（CSV）で取得を試みる
 *    → CSV は軽量かつパースが簡単（タイムアウトしにくい）
 * 2. CSV 取得に失敗した場合、または csvFlag=false の場合、
 *    type=1（XBRL ZIP）を取得して iXBRL/XBRL をパースする
 */
export async function extractFinancialData(
  docID: string,
  csvFlag: boolean = true
): Promise<ActionResult<ExtractionSummary>> {
  if (
    !edinetDocumentIdSchema.safeParse(docID).success ||
    typeof csvFlag !== 'boolean'
  ) {
    return { success: false, error: '書類情報が不正です' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }

  try {
    const apiKey = await resolveEdinetApiKey();

    // CSV 優先、フォールバックで XBRL
    if (csvFlag) {
      try {
        const zipData = await fetchDocumentData(docID, 5, apiKey);
        const summary = await extractFinancialMetrics(zipData);
        return { success: true, data: summary };
      } catch {
        // CSV取得失敗 → XBRLにフォールバック
      }
    }

    // XBRL パース（csvFlag=0 または CSV取得失敗時）
    const xbrlZip = await fetchDocumentData(docID, 1, apiKey);
    const summary = await extractFinancialMetricsFromXbrl(xbrlZip);
    return { success: true, data: summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'データ抽出に失敗しました';
    return { success: false, error: message };
  }
}

/** 同じ年度・四半期・連結区分のデータが既に存在するか確認する（上書き警告用） */
export async function checkExistingFinancialData(
  stockId: string,
  fiscalYear: number,
  fiscalQuarter: string,
  consolidationType: string
): Promise<ActionResult<boolean>> {
  const parsed = existingFinancialDataSchema.safeParse({
    stockId,
    fiscalYear,
    fiscalQuarter,
    consolidationType,
  });
  if (!parsed.success) {
    return { success: false, error: '検索条件が不正です' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase, user } = context;

  const { data, error } = await supabase
    .from('financial_data')
    .select('id')
    .eq('stock_id', parsed.data.stockId)
    .eq('user_id', user.id)
    .eq('fiscal_year', parsed.data.fiscalYear)
    .eq('fiscal_quarter', parsed.data.fiscalQuarter)
    .eq('consolidation_type', parsed.data.consolidationType)
    .maybeSingle();

  if (error) {
    console.error('checkExistingFinancialData failed:', error);
    return {
      success: false,
      error: '既存の財務データの確認に失敗しました',
    };
  }
  return { success: true, data: data != null };
}

/**
 * 抽出結果（ユーザーが編集済みの値を含む）を financial_data テーブルに保存する
 * 保存後、extraction_logs テーブルにも抽出ログを記録する（FR15: 判定過程の記録）
 */
export async function saveExtractedData(
  stockId: string,
  extraction: ExtractionSummary,
  fiscalYear: number,
  docId: string,
  fiscalQuarter: string = 'FY',
  consolidationType: string = 'consolidated'
): Promise<ActionResult> {
  const parsed = saveExtractedDataSchema.safeParse({
    stockId,
    extraction,
    fiscalYear,
    docId,
    fiscalQuarter,
    consolidationType,
  });
  if (!parsed.success) {
    return { success: false, error: '抽出データが不正です' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase, user } = context;

  const ownership = await checkStockOwnership(
    supabase,
    user.id,
    parsed.data.stockId
  );
  if (ownership === 'error') {
    return { success: false, error: '銘柄情報の確認に失敗しました' };
  }
  if (ownership === 'not_found') {
    return { success: false, error: '対象の銘柄が見つかりません' };
  }

  const { error } = await supabase.from('financial_data').upsert(
    // extractionToFinancialColumns は全カラム number | null を返すため、必須カラム
    // （revenue 等）の非null を TS が静的検証できずキャストが必要。
    // 抽出に欠損があれば DB の NOT NULL 制約でエラーになる（従来どおりの挙動）
    {
      user_id: user.id,
      stock_id: parsed.data.stockId,
      fiscal_year: parsed.data.fiscalYear,
      fiscal_quarter: parsed.data.fiscalQuarter,
      consolidation_type: parsed.data.consolidationType,
      // MetricKey → カラムの変換は extraction-to-row.ts に一本化されている
      ...extractionToFinancialColumns(parsed.data.extraction),
      input_unit: 'yen',
    } as TablesInsert<'financial_data'>,
    {
      onConflict:
        'user_id,stock_id,fiscal_year,fiscal_quarter,consolidation_type',
    }
  );

  if (error) {
    return { success: false, error: '財務データの保存に失敗しました' };
  }

  // FR15: 抽出ログを記録（どの書類から・どの経路で抽出したかの実値を残す）
  const logEntries = parsed.data.extraction.results.map((result) => ({
    user_id: user.id,
    stock_id: parsed.data.stockId,
    doc_id: parsed.data.docId,
    fiscal_year: parsed.data.fiscalYear,
    metric_key: result.metricKey,
    matched_tag: result.matchedTag,
    context_id: result.contextId,
    raw_value: result.value != null ? String(result.value) : null,
    normalized_value: result.value,
    confidence: result.confidence,
    accounting_standard: parsed.data.extraction.accountingStandard,
    source_type: parsed.data.extraction.sourceType,
  }));

  // 監査ログの書き込み失敗は主データの保存成功を妨げない（方針: console.error + 続行）。
  // ただし FR15 の要件なので、無言で握り潰さずログには必ず残す
  const { error: logError } = await supabase
    .from('extraction_logs')
    .insert(logEntries);
  if (logError) {
    console.error('extraction_logs insert failed:', logError);
  }

  revalidateStockPaths(parsed.data.stockId);
  return { success: true };
}

/**
 * FR16/FR17: 前回の抽出ログと比較してマッピング変更を検出する
 */
type MappingChange = {
  metricKey: string;
  previousTag: string | null;
  currentTag: string | null;
};

export async function checkMappingChanges(
  stockId: string,
  fiscalYear: number,
  currentResults: { metricKey: string; matchedTag: string | null }[]
): Promise<ActionResult<MappingChange[]>> {
  const parsed = mappingChangesSchema.safeParse({
    stockId,
    fiscalYear,
    currentResults,
  });
  if (!parsed.success) {
    return { success: false, error: '比較対象の抽出データが不正です' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase, user } = context;

  // 前年度の抽出ログを取得
  const { data: previousLogs, error } = await supabase
    .from('extraction_logs')
    .select('metric_key, matched_tag')
    .eq('stock_id', parsed.data.stockId)
    .eq('user_id', user.id)
    .eq('fiscal_year', parsed.data.fiscalYear - 1)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('checkMappingChanges failed:', error);
    return {
      success: false,
      error: '前年度の抽出ログの取得に失敗しました',
    };
  }
  if (!previousLogs || previousLogs.length === 0) {
    return { success: true, data: [] };
  }

  // 前回のタグをメトリックキーでグループ化（最新のものを使用）
  const previousTagMap = new Map<string, string | null>();
  for (const log of previousLogs) {
    if (!previousTagMap.has(log.metric_key)) {
      previousTagMap.set(log.metric_key, log.matched_tag);
    }
  }

  // 変更を検出
  const changes: MappingChange[] = [];

  for (const result of parsed.data.currentResults) {
    const prevTag = previousTagMap.get(result.metricKey);
    if (prevTag !== undefined && prevTag !== result.matchedTag) {
      changes.push({
        metricKey: result.metricKey,
        previousTag: prevTag,
        currentTag: result.matchedTag,
      });
    }
  }

  return { success: true, data: changes };
}
