/**
 * 銘柄関連ページのキャッシュ無効化ヘルパー
 *
 * Next.js の revalidatePath('/stocks') は配下の動的ルート（/stocks/[id]）を
 * 無効化しない。そのため銘柄に対する変更は「一覧」と「対象銘柄の詳細」の
 * 両方を無効化する必要がある。アクションごとにバラバラに書くと
 * 「詳細ページに反映されない」抜けが起こるため、必ずこのヘルパーを使うこと。
 */
import { revalidatePath } from 'next/cache';

/**
 * 銘柄一覧・比較・ポートフォリオと、指定があれば対象銘柄の詳細を無効化します。
 *
 * 財務データや取引は複数画面の集計元になるため、一覧だけを更新すると画面間で
 * 数値が食い違います。銘柄に紐づく更新は常に同じ依存ページを無効化します。
 */
export function revalidateStockPaths(stockId?: string): void {
  revalidatePath('/stocks');
  revalidatePath('/stocks/compare');
  revalidatePath('/stocks/portfolio');
  if (stockId) revalidatePath(`/stocks/${stockId}`);
}
