/**
 * EDINET マスタの Server Actions
 *
 * - fetchAndStoreMasterData: 指定日のEDINET書類一覧を取得し、有報のCSVをパースしてマスタに保存する
 * - searchMasterByStockCode: 証券コードでマスタを検索する（ユーザー向け、即座に結果を返す）
 * - importMasterToFinancialData: マスタの値をユーザーの financial_data にコピーする
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { fetchDocumentList, filterAnnualReports, fetchDocumentData } from '@/lib/edinet/client';
import { extractFinancialMetrics } from '@/lib/edinet/csv-parser';
import { extractFinancialMetricsFromXbrl } from '@/lib/edinet/xbrl-parser';
import type { ExtractionSummary } from '@/lib/edinet/csv-parser';

type MasterRow = {
  id: string;
  doc_id: string;
  sec_code: string;
  filer_name: string;
  fiscal_year: number;
  period_start: string | null;
  period_end: string | null;
  accounting_standard: string | null;
  extraction_status: string;
  revenue: number | null;
  operating_income: number | null;
  net_income: number | null;
  total_assets: number | null;
  equity: number | null;
  interest_bearing_debt: number | null;
  operating_cf: number | null;
  investing_cf: number | null;
  shares_outstanding: number | null;
  interest_expense: number | null;
  cash_and_equivalents: number | null;
  current_assets: number | null;
  investments_and_other_assets: number | null;
  current_liabilities: number | null;
  non_current_liabilities: number | null;
  shareholders_equity: number | null;
};

/** 抽出結果からマスタ行のカラムマッピングを生成する */
function extractionToColumns(extraction: ExtractionSummary) {
  const getValue = (key: string) =>
    extraction.results.find((r) => r.metricKey === key)?.value ?? null;

  return {
    accounting_standard: extraction.accountingStandard,
    revenue: getValue('revenue'),
    operating_income: getValue('operating_profit'),
    net_income: getValue('net_income_parent'),
    total_assets: getValue('total_assets'),
    equity: getValue('equity'),
    interest_bearing_debt: getValue('interest_bearing_debt'),
    operating_cf: getValue('operating_cf'),
    investing_cf: getValue('investing_cf'),
    shares_outstanding: getValue('issued_shares'),
    interest_expense: getValue('interest_expense'),
    cash_and_equivalents: getValue('cash_and_equivalents'),
    current_assets: getValue('current_assets'),
    investments_and_other_assets: getValue('investments_and_other_assets'),
    current_liabilities: getValue('current_liabilities'),
    non_current_liabilities: getValue('non_current_liabilities'),
    shareholders_equity: getValue('shareholders_equity'),
  };
}

/**
 * 指定日の EDINET 書類一覧を取得し、有報の CSV をパースしてマスタに保存する。
 * 管理者が手動で実行するか、将来的に Cron で自動実行する。
 */
export async function fetchAndStoreMasterData(
  date: string,
): Promise<{ success: boolean; error?: string; added: number; processed: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です', added: 0, processed: 0 };

  try {
    const response = await fetchDocumentList(date);
    if (!response.results) return { success: true, added: 0, processed: 0 };

    const reports = filterAnnualReports(response.results);
    let added = 0;
    let processed = 0;

    for (const report of reports) {
      processed++;

      // 既にマスタにある場合はスキップ
      const { data: existing } = await supabase
        .from('edinet_master')
        .select('id')
        .eq('doc_id', report.docID)
        .maybeSingle();

      if (existing) continue;

      // 年度を推定
      const fiscalYear = report.periodEnd
        ? new Date(report.periodEnd).getFullYear()
        : new Date(date).getFullYear();

      // まず pending で登録
      const { error: insertError } = await supabase.from('edinet_master').insert({
        doc_id: report.docID,
        sec_code: report.secCode,
        edinet_code: report.edinetCode,
        filer_name: report.filerName,
        doc_description: report.docDescription,
        period_start: report.periodStart,
        period_end: report.periodEnd,
        fiscal_year: fiscalYear,
        extraction_status: 'pending',
      });

      if (insertError) continue;

      // CSV/XBRL を取得してパース
      try {
        let extraction: ExtractionSummary;
        if (report.csvFlag) {
          const zipData = await fetchDocumentData(report.docID, 5);
          extraction = await extractFinancialMetrics(zipData);
        } else {
          const zipData = await fetchDocumentData(report.docID, 1);
          extraction = await extractFinancialMetricsFromXbrl(zipData);
        }

        const columns = extractionToColumns(extraction);

        await supabase
          .from('edinet_master')
          .update({
            ...columns,
            extraction_status: 'done',
            fetched_at: new Date().toISOString(),
          })
          .eq('doc_id', report.docID);

        added++;
      } catch (err) {
        await supabase
          .from('edinet_master')
          .update({
            extraction_status: 'error',
            error_message: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('doc_id', report.docID);
      }

      // レート制限
      await new Promise((r) => setTimeout(r, 3000));
    }

    return { success: true, added, processed };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'バッチ取得に失敗しました';
    return { success: false, error: message, added: 0, processed: 0 };
  }
}

/**
 * 証券コードでマスタを検索する。DB から即座に結果を返す（API呼び出しなし）。
 */
export async function searchMasterByStockCode(
  stockCode: string,
): Promise<{ success: boolean; data?: MasterRow[] }> {
  const supabase = await createClient();

  // 4桁の証券コード → 5桁の secCode（末尾0）で検索
  const secCode5 = stockCode.length === 4 ? stockCode + '0' : stockCode;

  const { data } = await supabase
    .from('edinet_master')
    .select('*')
    .eq('sec_code', secCode5)
    .eq('extraction_status', 'done')
    .order('fiscal_year', { ascending: false });

  return { success: true, data: (data as MasterRow[]) ?? [] };
}

/**
 * マスタの値をユーザーの financial_data にコピーする。
 */
export async function importMasterToFinancialData(
  stockId: string,
  masterDocId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  const { data: master } = await supabase
    .from('edinet_master')
    .select('*')
    .eq('doc_id', masterDocId)
    .single();

  if (!master) return { success: false, error: 'マスタデータが見つかりません' };

  const { error } = await supabase.from('financial_data').upsert(
    {
      user_id: user.id,
      stock_id: stockId,
      fiscal_year: master.fiscal_year,
      fiscal_quarter: 'FY',
      consolidation_type: 'consolidated',
      revenue: master.revenue,
      operating_income: master.operating_income,
      net_income: master.net_income,
      total_assets: master.total_assets,
      equity: master.equity,
      interest_bearing_debt: master.interest_bearing_debt,
      operating_cf: master.operating_cf,
      investing_cf: master.investing_cf,
      shares_outstanding: master.shares_outstanding,
      interest_expense: master.interest_expense,
      cash_and_equivalents: master.cash_and_equivalents,
      current_assets: master.current_assets,
      investments_and_other_assets: master.investments_and_other_assets,
      current_liabilities: master.current_liabilities,
      non_current_liabilities: master.non_current_liabilities,
      shareholders_equity: master.shareholders_equity,
      input_unit: 'yen',
    },
    { onConflict: 'user_id,stock_id,fiscal_year,fiscal_quarter,consolidation_type' },
  );

  if (error) {
    return { success: false, error: '財務データの取り込みに失敗しました' };
  }

  revalidatePath('/stocks');
  return { success: true };
}
