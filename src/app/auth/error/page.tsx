/**
 * 認証エラーコードを安全な利用者向けメッセージへ変換して表示します。
 */
import { AuthPageShell } from '@/components/layout/auth-page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Suspense } from 'react';

const errorMessages: Record<string, string> = {
  // 固定エラーコード（confirm route から渡される。生メッセージはURLに載せない方針）
  verification_failed:
    '認証リンクが無効または期限切れです。再度サインアップしてください。',
  missing_params: '認証リンクが無効です。再度サインアップしてください。',
  // 旧形式（生メッセージ）の後方互換。メール内の古いリンク経由で届く可能性があるため残す
  'No token hash or type':
    '認証リンクが無効です。再度サインアップしてください。',
  'Email link is invalid or has expired':
    '認証リンクが無効または期限切れです。再度サインアップしてください。',
  'Token has expired or is invalid':
    'トークンが期限切れまたは無効です。再度サインアップしてください。',
};

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error
    ? (errorMessages[error] ?? '認証処理中にエラーが発生しました。')
    : '予期しないエラーが発生しました。';

  return (
    <p className="text-sm text-muted-foreground" role="alert">
      {message}
    </p>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <AuthPageShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">エラーが発生しました</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground" role="status">
                エラー内容を確認しています...
              </p>
            }
          >
            <ErrorMessage searchParams={searchParams} />
          </Suspense>
          <nav
            className="mt-4 flex flex-col gap-2 text-center text-sm"
            aria-label="認証ページ"
          >
            <Link href="/auth/sign-up" className="underline underline-offset-4">
              アカウント作成
            </Link>
            <Link href="/auth/login" className="underline underline-offset-4">
              ログイン
            </Link>
          </nav>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
