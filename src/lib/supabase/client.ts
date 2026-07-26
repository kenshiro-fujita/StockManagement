/**
 * Client Component 用の型付き Supabase クライアントを生成します。
 *
 * セッションをリクエスト間で共有しない SSR 構成に合わせ、利用側で必要になった
 * タイミングにクライアントを生成します。
 */
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';
import { getSupabasePublicConfig } from '@/lib/supabase/env';

export function createClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
