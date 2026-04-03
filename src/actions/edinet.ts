'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { searchAnnualReports, fetchDocumentData } from '@/lib/edinet/client';
import { extractFinancialMetrics, type ExtractionSummary } from '@/lib/edinet/csv-parser';
import { extractFinancialMetricsFromXbrl } from '@/lib/edinet/xbrl-parser';
import type { AnnualReport } from '@/lib/edinet/types';

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

  if (!process.env.EDINET_API_KEY) {
    return { success: false, error: 'EDINET APIキーが設定されていません。管理者に連絡してください。' };
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
 * EDINET CSV (type=5) から財務データを抽出する
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

/**
 * 抽出結果を financial_data テーブルに保存する
 */
/**
 * 同じ年度・四半期・連結区分のデータが既に存在するか確認する
 */
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

  // 抽出結果をフィールドにマッピング
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

  revalidatePath('/stocks');
  return { success: true };
}
