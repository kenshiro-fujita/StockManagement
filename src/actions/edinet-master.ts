/**
 * EDINET マスタの Server Actions
 *
 * - fetchAndStoreMasterData: 指定日のEDINET書類一覧を取得し、有報のCSVをパースしてマスタに保存する
 * - searchMasterByStockCode: 証券コードでマスタを検索する（ユーザー向け、即座に結果を返す）
 * - importMasterToFinancialData: マスタの値をユーザーの financial_data にコピーする
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedContext } from '@/lib/supabase/auth';
import { findOwnedStock } from '@/lib/supabase/ownership';
import { isAdmin } from '@/lib/auth/admin';
import {
  fetchDocumentList,
  filterAnnualReports,
  fetchDocumentData,
} from '@/lib/edinet/client';
import { resolveEdinetApiKey } from '@/lib/edinet/api-key';
import { extractFinancialMetrics } from '@/lib/edinet/csv-parser';
import { extractFinancialMetricsFromXbrl } from '@/lib/edinet/xbrl-parser';
import { validateDateRange } from '@/lib/edinet/date-range';
import type { ExtractionSummary } from '@/lib/edinet/csv-parser';
import {
  extractionToFinancialColumns,
  FINANCIAL_COLUMNS,
} from '@/lib/edinet/extraction-to-row';
import { revalidateStockPaths } from '@/lib/revalidate';
import { edinetDocumentIdSchema, stockIdSchema } from '@/lib/schemas/common';
import type { Tables, TablesInsert } from '@/lib/types/database';
import type { ActionResult } from '@/lib/types/action';
import { matchesStockCode } from '@/actions/_internal/edinet';

/** 一般ユーザーへ返す EDINET マスタ行です。生成済みDB型から導出します。 */
type MasterRow = Pick<
  Tables<'edinet_master'>,
  | 'id'
  | 'doc_id'
  | 'sec_code'
  | 'filer_name'
  | 'fiscal_year'
  | 'period_start'
  | 'period_end'
  | 'accounting_standard'
  | 'extraction_status'
  | 'revenue'
  | 'operating_income'
  | 'net_income'
  | 'total_assets'
  | 'equity'
  | 'interest_bearing_debt'
  | 'operating_cf'
  | 'investing_cf'
  | 'shares_outstanding'
  | 'interest_expense'
  | 'cash_and_equivalents'
  | 'current_assets'
  | 'investments_and_other_assets'
  | 'current_liabilities'
  | 'non_current_liabilities'
  | 'shareholders_equity'
>;

/** 管理画面の逐次抽出キューに表示する最小限のマスタ情報です。 */
type PendingMasterRecord = Pick<
  Tables<'edinet_master'>,
  'doc_id' | 'filer_name' | 'sec_code' | 'fiscal_year'
>;

/**
 * 抽出結果からマスタ行のカラムマッピングを生成する
 * 財務カラムの変換は extraction-to-row.ts（単一の真実の源）に委譲する
 */
function extractionToColumns(extraction: ExtractionSummary) {
  return {
    accounting_standard: extraction.accountingStandard,
    ...extractionToFinancialColumns(extraction),
  };
}

/**
 * Step 1: 指定日の書類一覧からメタデータのみをマスタに登録する（高速、CSV取得なし）
 * 1日あたり数秒で完了するため、日付ループ中のUI更新がスムーズになる。
 */
export async function registerMasterMetadata(date: string): Promise<{
  success: boolean;
  error?: string;
  registered: number;
  total: number;
}> {
  // 管理画面専用アクション。Server Action は UI を経由せず直接 POST できるため、
  // レイアウトの表示ゲートとは別に、アクション自身でも管理者権限を検証する
  if (!(await isAdmin())) {
    return {
      success: false,
      error: '権限がありません',
      registered: 0,
      total: 0,
    };
  }

  const range = validateDateRange(date, date, 1);
  if (!range.ok) {
    return {
      success: false,
      error: range.error,
      registered: 0,
      total: 0,
    };
  }

  const supabase = await createClient();

  try {
    const apiKey = await resolveEdinetApiKey();
    const response = await fetchDocumentList(date, apiKey);
    if (!response.results) return { success: true, registered: 0, total: 0 };

    const reports = filterAnnualReports(response.results);
    if (reports.length === 0) return { success: true, registered: 0, total: 0 };

    // 書類ごとに SELECT+INSERT を直列で回すと N+1 になる（1日50件なら100往復）。
    // doc_id のユニーク制約を利用し、ignoreDuplicates で一括 upsert する
    const rows = reports.map((report) => ({
      doc_id: report.docID,
      sec_code: report.secCode,
      edinet_code: report.edinetCode,
      filer_name: report.filerName,
      doc_description: report.docDescription,
      period_start: report.periodStart,
      period_end: report.periodEnd,
      fiscal_year: report.periodEnd
        ? new Date(report.periodEnd).getFullYear()
        : new Date(`${date}T00:00:00Z`).getUTCFullYear(),
      extraction_status: 'pending',
    }));

    const { data: inserted, error: upsertError } = await supabase
      .from('edinet_master')
      .upsert(rows, { onConflict: 'doc_id', ignoreDuplicates: true })
      .select('id');

    if (upsertError) {
      return {
        success: false,
        error: 'マスタの登録に失敗しました',
        registered: 0,
        total: reports.length,
      };
    }

    // ignoreDuplicates のため、新規登録された行数は返ってきた行数
    return {
      success: true,
      registered: inserted?.length ?? 0,
      total: reports.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'メタデータ取得に失敗しました';
    return { success: false, error: message, registered: 0, total: 0 };
  }
}

/**
 * Step 2: pending 状態のマスタレコード1件の CSV/XBRL を取得してパースする。
 * 1件ずつ呼ぶことで進捗表示をリアルタイムに更新できる。
 */
export async function extractSingleMasterRecord(
  docId: string
): Promise<ActionResult> {
  // 管理画面専用アクション（外部APIの大量呼び出しを伴うため管理者限定）
  if (!(await isAdmin())) return { success: false, error: '権限がありません' };
  if (!edinetDocumentIdSchema.safeParse(docId).success) {
    return { success: false, error: '書類IDが不正です' };
  }

  const supabase = await createClient();

  try {
    const apiKey = await resolveEdinetApiKey();

    // まず CSV (type=5) を試す → 失敗したら XBRL (type=1)
    let extraction: ExtractionSummary;
    try {
      const zipData = await fetchDocumentData(docId, 5, apiKey);
      extraction = await extractFinancialMetrics(zipData);
    } catch {
      const zipData = await fetchDocumentData(docId, 1, apiKey);
      extraction = await extractFinancialMetricsFromXbrl(zipData);
    }

    const columns = extractionToColumns(extraction);

    const { data: updated, error: updateError } = await supabase
      .from('edinet_master')
      .update({
        ...columns,
        extraction_status: 'done',
        fetched_at: new Date().toISOString(),
      })
      .eq('doc_id', docId)
      .select('id');

    if (updateError || !updated || updated.length === 0) {
      return { success: false, error: '抽出結果の保存に失敗しました' };
    }

    return { success: true };
  } catch (err) {
    const { error: statusError } = await supabase
      .from('edinet_master')
      .update({
        extraction_status: 'error',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      })
      .eq('doc_id', docId);

    if (statusError) {
      console.error('edinet_master error status update failed:', statusError);
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'パース失敗',
    };
  }
}

/** pending 状態のマスタレコード一覧を取得する（Step 2 のループ用） */
export async function getPendingMasterRecords(): Promise<
  ActionResult<PendingMasterRecord[]>
> {
  // 管理画面専用（バッチ処理のループ起点になるため管理者限定）
  if (!(await isAdmin())) {
    return { success: false, error: '権限がありません' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('edinet_master')
    .select('doc_id, filer_name, sec_code, fiscal_year')
    .eq('extraction_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getPendingMasterRecords failed:', error);
    return {
      success: false,
      error: '抽出待ちデータの取得に失敗しました',
    };
  }
  return { success: true, data: data ?? [] };
}

/**
 * 証券コードでマスタを検索する。DB から即座に結果を返す（API呼び出しなし）。
 */
export async function searchMasterByStockCode(
  stockCode: string
): Promise<ActionResult<MasterRow[]>> {
  if (!/^[0-9A-Za-z]{4,5}$/.test(stockCode)) {
    return { success: false, error: '証券コードが不正です' };
  }

  // 一般ユーザー向けの参照系でも、Server Action の直接POSTは認証境界で拒否します。
  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase } = context;

  // EDINET は英字入りコードを大文字で保持するため、入力の大小文字差を正規化します。
  const normalizedStockCode = stockCode.toUpperCase();
  const secCode5 =
    normalizedStockCode.length === 4
      ? normalizedStockCode + '0'
      : normalizedStockCode;

  const { data, error } = await supabase
    .from('edinet_master')
    .select('*')
    .eq('sec_code', secCode5)
    .eq('extraction_status', 'done')
    .order('fiscal_year', { ascending: false });

  if (error) {
    return {
      success: false,
      error: 'マスタデータの検索に失敗しました',
    };
  }

  return { success: true, data: data ?? [] };
}

/**
 * マスタの値をユーザーの financial_data にコピーする。
 */
export async function importMasterToFinancialData(
  stockId: string,
  masterDocId: string
): Promise<ActionResult> {
  if (
    !edinetDocumentIdSchema.safeParse(masterDocId).success ||
    !stockIdSchema.safeParse(stockId).success
  ) {
    return { success: false, error: '入力内容に誤りがあります' };
  }

  const context = await getAuthenticatedContext();
  if (!context) return { success: false, error: '認証が必要です' };
  const { supabase, user } = context;

  // 取り込み先の銘柄が自分のものであることを確認する
  // （RLS でも防がれるが、他人の stock_id を指す行を自分名義で作る事故を防ぐ多層防御）
  const ownership = await findOwnedStock(supabase, user.id, stockId);
  if (ownership.status === 'error') {
    return { success: false, error: '銘柄情報の確認に失敗しました' };
  }
  if (ownership.status === 'not_found') {
    return { success: false, error: '対象の銘柄が見つかりません' };
  }

  const { data: master, error: masterError } = await supabase
    .from('edinet_master')
    .select('*')
    .eq('doc_id', masterDocId)
    .maybeSingle();

  if (masterError) {
    return { success: false, error: 'マスタデータの取得に失敗しました' };
  }
  if (!master) return { success: false, error: 'マスタデータが見つかりません' };
  if (!matchesStockCode(ownership.stock.stock_code, master.sec_code)) {
    return {
      success: false,
      error: 'マスタデータの証券コードが対象銘柄と一致しません',
    };
  }

  // マスタ → financial_data へ財務カラムをコピーする。
  // カラム一覧は FINANCIAL_COLUMNS（単一の真実の源）から導出し、列挙の二重管理を避ける
  const financialValues = Object.fromEntries(
    FINANCIAL_COLUMNS.map((col) => [col, master[col] ?? null])
  );

  const { error } = await supabase.from('financial_data').upsert(
    // FINANCIAL_COLUMNS による動的スプレッドのため、必須カラム（revenue 等）の存在を
    // TS が静的検証できずキャストが必要。値は edinet_master の同名カラム由来であり、
    // 欠損（null）があれば DB の NOT NULL 制約でエラーになる（従来どおりの挙動）
    {
      user_id: user.id,
      stock_id: stockId,
      fiscal_year: master.fiscal_year,
      fiscal_quarter: 'FY',
      consolidation_type: 'consolidated',
      ...financialValues,
      input_unit: 'yen',
    } as TablesInsert<'financial_data'>,
    {
      onConflict:
        'user_id,stock_id,fiscal_year,fiscal_quarter,consolidation_type',
    }
  );

  if (error) {
    return { success: false, error: '財務データの取り込みに失敗しました' };
  }

  revalidateStockPaths(stockId);
  return { success: true };
}
