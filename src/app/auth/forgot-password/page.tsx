/**
 * パスワード再設定メールの送信フォームを共通レイアウト内に表示します。
 */
import { ForgotPasswordForm } from '@/components/forgot-password-form';
import { AuthPageShell } from '@/components/layout/auth-page-shell';

export default function Page() {
  return (
    <AuthPageShell>
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
