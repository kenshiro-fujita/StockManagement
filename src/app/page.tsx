/**
 * トップページ
 *
 * - 開発環境: モード選択（開発用アカウントでのワンクリックログイン）を表示する。
 *   資格情報を本番バンドルに含めないため、ModeSelector は development でのみ描画する。
 * - 本番環境: 通常のログイン/サインアップ導線を表示する。
 */
import Link from 'next/link';
import { ModeSelector } from '@/components/mode-selector';
import { Button } from '@/components/ui/button';

/** 本番用のログイン導線（認証は /auth 配下の通常フローで行う） */
function AuthLinks() {
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <Button asChild size="lg">
        <Link href="/auth/login">ログイン</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/auth/sign-up">アカウント作成</Link>
      </Button>
    </div>
  );
}

export default function Home() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">株式分析ツール</h1>
          <p className="mt-2 text-muted-foreground">
            中長期投資のための財務分析・理論株価算出アプリ
          </p>
        </div>
        {isDevelopment ? <ModeSelector /> : <AuthLinks />}
      </div>
    </div>
  );
}
