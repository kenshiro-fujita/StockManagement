/**
 * アカウント作成フォームを共通の認証画面レイアウト内に表示します。
 */
import { SignUpForm } from '@/components/sign-up-form';
import { AuthPageShell } from '@/components/layout/auth-page-shell';

export default function Page() {
  return (
    <AuthPageShell>
      <SignUpForm />
    </AuthPageShell>
  );
}
