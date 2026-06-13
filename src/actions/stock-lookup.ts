/**
 * 証券コードから企業情報を自動取得する Server Action
 *
 * 解決順:
 * 1. edinet_master テーブルを逆引き（即座に返る。バッチ取得済みなら API 不要）
 * 2. 見つからなければ EDINET の書類一覧 API を直近 LOOKUP_DAYS 日ぶん検索
 *
 * 以前は常に API を直近30日ぶん直列ループ（各3秒スリープ）しており、
 * 見つからない場合は最悪90秒以上ブロックして Server Action がタイムアウトしていた。
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchDocumentList } from '@/lib/edinet/client';
import { resolveEdinetApiKey } from '@/lib/edinet/api-key';

export type StockLookupResult = {
  companyName: string;
  edinetCode: string | null;
  secCode: string;
};

/** API フォールバック時に遡る日数（タイムアウトを避けるため短めにする） */
const LOOKUP_DAYS = 7;
/** EDINET のレート制限対策の待機（ミリ秒） */
const RATE_LIMIT_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function lookupStockByCode(
  stockCode: string,
): Promise<{ success: boolean; error?: string; data?: StockLookupResult }> {
  if (!/^\d{4}$/.test(stockCode)) {
    return { success: false, error: '4桁の証券コードで入力してください' };
  }

  // まずマスタを逆引きする（バッチ取得済みなら API を叩かず即座に返る）
  const supabase = await createClient();
  const secCode5 = `${stockCode}0`;
  const { data: master } = await supabase
    .from('edinet_master')
    .select('filer_name, edinet_code, sec_code')
    .eq('sec_code', secCode5)
    .order('fiscal_year', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (master) {
    return {
      success: true,
      data: {
        companyName: master.filer_name,
        edinetCode: master.edinet_code,
        secCode: master.sec_code,
      },
    };
  }

  // マスタに無ければ API フォールバック（直近 LOOKUP_DAYS 日のみ）
  try {
    const apiKey = await resolveEdinetApiKey();
    const today = new Date();

    for (let i = 0; i < LOOKUP_DAYS; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const response = await fetchDocumentList(dateStr, apiKey);
      const match = response.results?.find(
        (doc) => doc.secCode && doc.secCode.slice(0, 4) === stockCode && doc.filerName,
      );

      if (match) {
        return {
          success: true,
          data: {
            companyName: match.filerName!,
            edinetCode: match.edinetCode,
            secCode: match.secCode!,
          },
        };
      }

      // 最終ループ後は待たない（無駄な待機を避ける）
      if (i < LOOKUP_DAYS - 1) await sleep(RATE_LIMIT_DELAY_MS);
    }

    return { success: false, error: `証券コード ${stockCode} の企業が見つかりませんでした` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EDINET API に接続できませんでした';
    return { success: false, error: message };
  }
}
