/**
 * モード選択トップページ
 *
 * 通常モード（一般ユーザー画面）と管理者モード（管理画面）を選べる。
 * 各モードのボタンを押すと、対応するユーザーで自動ログインしてから遷移する。
 */
import { ModeSelector } from '@/components/mode-selector';

export default function Home() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">株式分析ツール</h1>
          <p className="mt-2 text-muted-foreground">
            中長期投資のための財務分析・理論株価算出アプリ
          </p>
        </div>
        <ModeSelector />
      </div>
    </div>
  );
}
