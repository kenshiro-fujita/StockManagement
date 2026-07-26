/**
 * 銘柄管理画面のレイアウトです。
 *
 * 認証とナビゲーションは設定画面と共有し、このファイルは App Router の
 * レイアウト境界を宣言する責務だけを持ちます。
 */
import { AuthenticatedAppShell } from '@/components/layout/authenticated-app-shell';

export default function StocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
