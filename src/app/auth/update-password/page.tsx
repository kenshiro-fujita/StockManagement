/**
 * 新しいパスワードの入力フォームを共通の認証画面レイアウト内に表示します。
 */
import { UpdatePasswordForm } from '@/components/update-password-form';
import { AuthPageShell } from '@/components/layout/auth-page-shell';

export default function Page() {
  return (
    <AuthPageShell>
      <UpdatePasswordForm />
    </AuthPageShell>
  );
}
