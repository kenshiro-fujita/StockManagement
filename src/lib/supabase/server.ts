/**
 * Server Component / Server Action 用の型付き Supabase クライアントを生成します。
 *
 * Cookie ストアとクライアントはリクエストをまたいで共有せず、認証状態が別ユーザーへ
 * 漏れないよう呼び出しごとに構築します。
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';
import { getSupabasePublicConfig } from '@/lib/supabase/env';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component の Cookie は読み取り専用です。
          // Proxy がセッションを更新する構成なので、ここでの書き込み失敗は無視できます。
        }
      },
    },
  });
}
