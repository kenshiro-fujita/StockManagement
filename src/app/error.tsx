/**
 * ルート直下で捕捉された予期しないエラーの回復UIです。
 */
'use client';

import { RouteError } from '@/components/layout/route-error';

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError backHref="/" backLabel="トップへ戻る" reset={reset} />;
}
