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

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { searchAnnualReports, fetchDocumentData } from '@/lib/edinet/client';
import { extractFinancialMetrics, type ExtractionSummary } from '@/lib/edinet/csv-parser';
import { extractFinancialMetricsFromXbrl } from '@/lib/edinet/xbrl-parser';
import type { AnnualReport } from '@/lib/edinet/types';

/** 証券コードと日付範囲を指定して EDINET から有価証券報告書を検索する */
export async function searchEdinetDocuments(
  stockId: string,
  stockCode: string,
  startDate: string,
  endDate: string,
): Promise<{ success: boolean; error?: string; data?: AnnualReport[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  try {
    const reports = await searchAnnualReports(stockCode, startDate, endDate);

    if (reports.length === 0) {
      return { success: true, data: [] };
    }

    return { success: true, data: reports };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EDINET APIへの接続に失敗しました';
    return { success: false, error: message };
  }
}

/** 検索結果の書類メタデータを edinet_documents テーブルに保存する（upsert） */
export async function saveEdinetDocument(
  stockId: string,
  report: AnnualReport,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  const { error } = await supabase.from('edinet_documents').upsert(
    {
      user_id: user.id,
      stock_id: stockId,
      doc_id: report.docID,
      sec_code: report.secCode,
      edinet_code: report.edinetCode,
      filer_name: report.filerName,
      doc_type_code: '120',
      doc_description: report.docDescription,
      file_date: report.submitDateTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      period_start: report.periodStart,
      period_end: report.periodEnd,
      xbrl_flag: report.xbrlFlag ? '1' : '0',
      csv_flag: report.csvFlag ? '1' : '0',
      status: 'pending',
    },
    { onConflict: 'user_id,doc_id' },
  );

  if (error) {
    return { success: false, error: '書類情報の保存に失敗しました' };
  }

  revalidatePath('/stocks');
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
  csvFlag: boolean = true,
): Promise<{ success: boolean; error?: string; data?: ExtractionSummary }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  try {
    // CSV 優先、フォールバックで XBRL
    if (csvFlag) {
      try {
        const zipData = await fetchDocumentData(docID, 5);
        const summary = await extractFinancialMetrics(zipData);
        return { success: true, data: summary };
      } catch {
        // CSV取得失敗 → XBRLにフォールバック
      }
    }

    // XBRL パース（csvFlag=0 または CSV取得失敗時）
    const xbrlZip = await fetchDocumentData(docID, 1);
    const summary = await extractFinancialMetricsFromXbrl(xbrlZip);
    return { success: true, data: summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'データ抽出に失敗しました';
    return { success: false, error: message };
  }
}

/** 同じ年度・四半期・連結区分のデータが既に存在するか確認する（上書き警告用） */
export async function checkExistingFinancialData(
  stockId: string,
  fiscalYear: number,
  fiscalQuarter: string,
  consolidationType: string,
): Promise<{ exists: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('financial_data')
    .select('id')
    .eq('stock_id', stockId)
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_quarter', fiscalQuarter)
    .eq('consolidation_type', consolidationType)
    .maybeSingle();

  return { exists: data != null };
}

/**
 * 抽出結果（ユーザーが編集済みの値を含む）を financial_data テーブルに保存する
 * 保存後、extraction_logs テーブルにも抽出ログを記録する（FR15: 判定過程の記録）
 */
export async function saveExtractedData(
  stockId: string,
  extraction: ExtractionSummary,
  fiscalYear: number,
  fiscalQuarter: string = 'FY',
  consolidationType: string = 'consolidated',
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  // 抽出結果の MetricKey → financial_data カラムへのマッピング
  // MetricKey（例: 'operating_profit'）と DB カラム（例: 'operating_income'）は名前が異なる場合がある
  const getValue = (key: string) =>
    extraction.results.find((r) => r.metricKey === key)?.value ?? null;

  const { error } = await supabase.from('financial_data').upsert(
    {
      user_id: user.id,
      stock_id: stockId,
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      consolidation_type: consolidationType,
      revenue: getValue('revenue'),
      operating_income: getValue('operating_profit'),
      net_income: getValue('net_income_parent'),
      total_assets: getValue('total_assets'),
      equity: getValue('equity'),
      operating_cf: getValue('operating_cf'),
      investing_cf: getValue('investing_cf'),
      shares_outstanding: getValue('issued_shares'),
      interest_bearing_debt: getValue('interest_bearing_debt'),
      interest_expense: getValue('interest_expense'),
      input_unit: 'yen',
    },
    { onConflict: 'user_id,stock_id,fiscal_year,fiscal_quarter,consolidation_type' },
  );

  if (error) {
    return { success: false, error: '財務データの保存に失敗しました' };
  }

  // FR15: 抽出ログを記録
  const logEntries = extraction.results.map((r) => ({
    user_id: user.id,
    stock_id: stockId,
    doc_id: 'edinet-extraction',
    fiscal_year: fiscalYear,
    metric_key: r.metricKey,
    matched_tag: r.matchedTag,
    context_id: r.contextId,
    raw_value: r.value != null ? String(r.value) : null,
    normalized_value: r.value,
    confidence: r.confidence,
    accounting_standard: extraction.accountingStandard,
    source_type: 'csv',
  }));

  await supabase.from('extraction_logs').insert(logEntries);

  revalidatePath('/stocks');
  return { success: true };
}

/**
 * FR16/FR17: 前回の抽出ログと比較してマッピング変更を検出する
 */
export async function checkMappingChanges(
  stockId: string,
  fiscalYear: number,
  currentResults: { metricKey: string; matchedTag: string | null }[],
): Promise<{ changes: { metricKey: string; previousTag: string | null; currentTag: string | null }[] }> {
  const supabase = await createClient();

  // 前年度の抽出ログを取得
  const { data: previousLogs } = await supabase
    .from('extraction_logs')
    .select('metric_key, matched_tag')
    .eq('stock_id', stockId)
    .eq('fiscal_year', fiscalYear - 1)
    .order('created_at', { ascending: false });

  if (!previousLogs || previousLogs.length === 0) {
    return { changes: [] };
  }

  // 前回のタグをメトリックキーでグループ化（最新のものを使用）
  const previousTagMap = new Map<string, string | null>();
  for (const log of previousLogs) {
    if (!previousTagMap.has(log.metric_key)) {
      previousTagMap.set(log.metric_key, log.matched_tag);
    }
  }

  // 変更を検出
  const changes: { metricKey: string; previousTag: string | null; currentTag: string | null }[] = [];

  for (const result of currentResults) {
    const prevTag = previousTagMap.get(result.metricKey);
    if (prevTag !== undefined && prevTag !== result.matchedTag) {
      changes.push({
        metricKey: result.metricKey,
        previousTag: prevTag,
        currentTag: result.matchedTag,
      });
    }
  }

  return { changes };
}
