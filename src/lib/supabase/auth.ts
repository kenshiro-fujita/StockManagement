/**
 * 認証済み Server Action が共有するリクエストコンテキストを構築します。
 *
 * 各アクションでクライアント生成と `auth.getUser()` を繰り返すと、
 * エラー処理や認証境界が徐々にずれるため、この関数を唯一の入口にします。
 */
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/** リクエスト単位で生成した Supabase クライアントの型です。 */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** 認証済み処理に必要な依存をまとめたコンテキストです。 */
export type AuthenticatedContext = {
  supabase: ServerSupabaseClient;
  user: User;
};

/**
 * Supabase がサーバーで検証したユーザーを取得します。
 *
 * Cookie 内のセッション値を信用せず `getUser()` を使い、未認証と検証エラーは
 * どちらも `null` に正規化して、公開 API に内部エラーを漏らしません。
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { supabase, user };
}
