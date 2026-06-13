/**
 * 銘柄関連ページのキャッシュ無効化ヘルパー
 *
 * Next.js の revalidatePath('/stocks') は配下の動的ルート（/stocks/[id]）を
 * 無効化しない。そのため銘柄に対する変更は「一覧」と「対象銘柄の詳細」の
 * 両方を無効化する必要がある。アクションごとにバラバラに書くと
 * 「詳細ページに反映されない」抜けが起こるため、必ずこのヘルパーを使うこと。
 */
import { revalidatePath } from 'next/cache';

/** 銘柄一覧と（指定があれば）対象銘柄の詳細ページを無効化する */
export function revalidateStockPaths(stockId?: string): void {
  revalidatePath('/stocks');
  if (stockId) revalidatePath(`/stocks/${stockId}`);
}
