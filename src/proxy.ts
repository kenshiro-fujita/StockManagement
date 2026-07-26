/**
 * 認証Cookieを更新するアプリ共通のネットワーク境界です。
 *
 * Next.js 16のProxy規約に合わせ、各画面の描画前にSupabaseセッションを
 * 更新します。静的アセットは対象外にして不要な認証処理を避けます。
 */
import { updateSession } from '@/lib/supabase/proxy';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
