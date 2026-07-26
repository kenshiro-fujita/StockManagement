/**
 * 銘柄管理配下の予期しない取得・描画失敗から回復するUIです。
 */
'use client';

import { RouteError } from '@/components/layout/route-error';

export default function StocksError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError backHref="/stocks" backLabel="銘柄一覧へ戻る" reset={reset} />
  );
}
