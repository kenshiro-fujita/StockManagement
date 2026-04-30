/**
 * モード選択コンポーネント（トップページ用）
 *
 * 通常モード or 管理者モードを選択。
 * クリック時にハードコードされたテストユーザーで自動ログインしてから対応画面に遷移する。
 * 開発中の利便性のため、ログイン認証を意識せずに使えるようにする。
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutList, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

/** 開発用の固定アカウント */
const ACCOUNTS = {
  user: { email: 'test@example.com', password: 'Test1234!', dest: '/stocks' },
  admin: { email: 'fujimaster@stockmgmt.local', password: 'Fj!M4st3r#2026x', dest: '/ops-819a1ec26e72' },
} as const;

export function ModeSelector() {
  const [loadingMode, setLoadingMode] = useState<'user' | 'admin' | null>(null);
  const router = useRouter();

  const handleSelect = async (mode: 'user' | 'admin') => {
    setLoadingMode(mode);
    const account = ACCOUNTS[mode];
    const supabase = createClient();

    // 既存セッションがあればサインアウトしてから新規ログイン（モード切り替え時の混在を防ぐ）
    await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (error) {
      setLoadingMode(null);
      toast.error(`ログインに失敗しました: ${error.message}`);
      return;
    }

    router.push(account.dest);
    router.refresh();
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => handleSelect('user')}
        disabled={loadingMode !== null}
        className="rounded-lg border-2 border-teal-500 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 dark:hover:bg-teal-950/50 p-8 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3 mb-3">
          {loadingMode === 'user' ? (
            <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
          ) : (
            <LayoutList className="h-8 w-8 text-teal-600" />
          )}
          <h2 className="text-xl font-bold">通常モード</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          銘柄管理・財務データ入力・理論株価算出など、一般的な利用画面に進みます。
        </p>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('admin')}
        disabled={loadingMode !== null}
        className="rounded-lg border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 p-8 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3 mb-3">
          {loadingMode === 'admin' ? (
            <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
          ) : (
            <Shield className="h-8 w-8 text-amber-600" />
          )}
          <h2 className="text-xl font-bold">管理者モード</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          EDINET マスタデータの取得・管理など、管理者向けの機能に進みます。
        </p>
      </button>
    </div>
  );
}
