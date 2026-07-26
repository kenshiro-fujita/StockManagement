/**
 * Route Segment の Error Boundary が共有する回復UIです。
 *
 * DBや認証基盤の内部情報は表示せず、利用者が同じ画面を再試行するか
 * 安全な画面へ戻れる操作だけを提供します。
 */
'use client';

import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function RouteError({
  backHref,
  backLabel,
  description = 'データの取得中に問題が発生しました。時間をおいて再度お試しください。',
  reset,
  title = '画面を表示できませんでした',
}: {
  backHref: string;
  backLabel: string;
  description?: string;
  reset: () => void;
  title?: string;
}) {
  return (
    <div
      className="mx-auto flex max-w-lg flex-col items-center py-16 text-center"
      role="alert"
    >
      <AlertCircle
        className="mb-4 h-12 w-12 text-destructive"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          再試行
        </Button>
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
