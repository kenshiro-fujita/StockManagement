/**
 * アカウント作成後の案内を共通の認証画面レイアウト内に表示します。
 */
import { AuthPageShell } from '@/components/layout/auth-page-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';

export default function Page() {
  return (
    <AuthPageShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">登録ありがとうございます</CardTitle>
          <CardDescription>確認メールをご確認ください</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            アカウントの作成が完了しました。メールに届いた確認リンクをクリックして、アカウントを有効化してください。
          </p>
          <div className="mt-4 text-center text-sm">
            <Link href="/auth/login" className="underline underline-offset-4">
              ログインページへ
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
