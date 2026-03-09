import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Suspense } from 'react';

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-muted-foreground">
          エラー内容: {params.error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          予期しないエラーが発生しました。
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">エラーが発生しました</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
              <div className="mt-4 flex flex-col gap-2 text-center text-sm">
                <Link
                  href="/auth/sign-up"
                  className="underline underline-offset-4"
                >
                  アカウント作成
                </Link>
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  ログイン
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
