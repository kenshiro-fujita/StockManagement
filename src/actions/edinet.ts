'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { searchAnnualReports } from '@/lib/edinet/client';
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
