/**
 * 管理画面レイアウト
 *
 * admin ロールを持つユーザーのみアクセス可能。
 * 一般ユーザーがアクセスした場合は 404 を返す（管理画面の存在を隠す）。
 */
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/auth/admin';
import { connection } from 'next/server';
import Link from 'next/link';
import { Shield } from 'lucide-react';

/**
 * 管理者ゲート。isAdmin() は cookie（未キャッシュ）を読むため、
 * Cache Components モードでは Suspense の内側で実行する必要がある。
 * レイアウト本体で直接 await すると、配下の静的ページのプリレンダリングが
 * ドキュメント全体ブロッキングになりビルドが失敗する。
 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection();
  const admin = await isAdmin();
  if (!admin) notFound();
  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* 管理画面ヘッダー */}
      <header className="border-b bg-zinc-900 text-white">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-400" />
            <span className="font-bold">管理画面</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/ops-819a1ec26e72" className="hover:text-amber-300 transition-colors">
              ダッシュボード
            </Link>
            <Link href="/ops-819a1ec26e72/master" className="hover:text-amber-300 transition-colors">
              マスタ管理
            </Link>
            <Link href="/ops-819a1ec26e72/batch" className="hover:text-amber-300 transition-colors">
              バッチ取得
            </Link>
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
              ← モード選択に戻る
            </Link>
          </nav>
        </div>
      </header>

      {/* メインコンテンツ（認証ゲートを Suspense 境界の内側で実行） */}
      <main className="mx-auto max-w-6xl p-6">
        <Suspense fallback={null}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
