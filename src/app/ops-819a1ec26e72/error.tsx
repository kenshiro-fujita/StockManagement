/**
 * 管理画面の取得・バッチ表示失敗から管理者が回復するためのUIです。
 */
'use client';

import { RouteError } from '@/components/layout/route-error';

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      backHref="/ops-819a1ec26e72"
      backLabel="管理ダッシュボードへ戻る"
      reset={reset}
      title="管理画面を表示できませんでした"
    />
  );
}
