/**
 * 証券コードから企業情報を自動取得する Server Action
 *
 * EDINET の書類一覧 API を使って、指定された証券コードの企業名を逆引きする。
 * 直近30日間の書類一覧を検索し、secCode が一致する書類から企業名を取得する。
 */
'use server';

import { fetchDocumentList } from '@/lib/edinet/client';
import { resolveEdinetApiKey } from '@/lib/edinet/api-key';

export type StockLookupResult = {
  companyName: string;
  edinetCode: string | null;
  secCode: string;
};

export async function lookupStockByCode(
  stockCode: string,
): Promise<{ success: boolean; error?: string; data?: StockLookupResult }> {
  if (!stockCode || stockCode.length !== 4) {
    return { success: false, error: '4桁の証券コードを入力してください' };
  }

  try {
    // user_settings → 環境変数 の順で解決（env 直チェックだと設定画面で登録した
    // キーを持つユーザーを誤ってブロックしてしまうため、共通の解決ロジックを使う）
    const apiKey = await resolveEdinetApiKey();

    // 直近30日分を検索（有報以外の書類にも企業名が含まれる）
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const response = await fetchDocumentList(dateStr, apiKey);
      if (!response.results) continue;

      // secCode の先頭4桁で照合
      const match = response.results.find(
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

      // レート制限: 3秒待つ
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    return { success: false, error: `証券コード ${stockCode} の企業が見つかりませんでした` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EDINET API に接続できませんでした';
    return { success: false, error: message };
  }
}
