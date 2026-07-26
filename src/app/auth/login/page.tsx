/**
 * ログインフォームを共通の認証画面レイアウト内に表示します。
 */
import { LoginForm } from '@/components/login-form';
import { AuthPageShell } from '@/components/layout/auth-page-shell';

export default function Page() {
  return (
    <AuthPageShell>
      <LoginForm />
    </AuthPageShell>
  );
}
