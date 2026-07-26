/**
 * 認証画面で共通利用する中央寄せレイアウトです。
 *
 * ページごとに余白や最大幅を複製すると認証フロー内で見た目がずれやすいため、
 * コンテンツだけを差し替えられる単一のシェルとして管理します。
 */
import type { ReactNode } from 'react';

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
