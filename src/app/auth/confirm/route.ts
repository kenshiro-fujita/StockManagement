import { createClient } from '@/lib/supabase/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';

/**
 * next パラメータを安全な相対パスに正規化する。
 * 外部URL（https://... や //evil.com）を許すとメール確認リンクを使った
 * オープンリダイレクト（フィッシング誘導）になるため、
 * 「/ で始まり // で始まらない」アプリ内パスのみ許可する。
 */
function sanitizeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = sanitizeNextPath(searchParams.get('next'));

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      redirect(next);
    } else {
      // 生のエラーメッセージを URL に載せると内部情報がログ等に残るため、
      // 固定のエラーコードで受け渡す（表示文言は error ページ側でマッピング）
      redirect('/auth/error?error=verification_failed');
    }
  }

  redirect('/auth/error?error=missing_params');
}
