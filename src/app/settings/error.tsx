/**
 * ユーザー設定の取得・更新画面を表示できない場合の回復UIです。
 */
'use client';

import { RouteError } from '@/components/layout/route-error';

export default function SettingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      backHref="/stocks"
      backLabel="銘柄一覧へ戻る"
      reset={reset}
      title="設定画面を表示できませんでした"
    />
  );
}
