/**
 * ユーザー設定画面のレイアウトです。
 *
 * 銘柄画面と同じ認証済みアプリシェルを利用し、画面間でサイドバーの
 * データや認証挙動が食い違わないようにします。
 */
import { AuthenticatedAppShell } from '@/components/layout/authenticated-app-shell';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
