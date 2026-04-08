/**
 * 管理者判定ユーティリティ
 *
 * user_metadata.role === 'admin' で管理者かどうかを判定する。
 * 管理画面へのアクセス制御と、UI の表示分岐に使用する。
 */
import { createClient } from '@/lib/supabase/server';

/** 現在のユーザーが管理者かどうかを判定する */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return user.user_metadata?.role === 'admin';
}

/** 管理画面のURLパス（環境変数から取得、推測防止） */
export function getAdminPath(): string {
  return process.env.NEXT_PUBLIC_ADMIN_PATH ?? 'ops-default';
}
