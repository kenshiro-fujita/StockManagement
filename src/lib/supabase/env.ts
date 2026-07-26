/**
 * Supabase クライアントが共有する公開接続設定を検証します。
 *
 * 非 null 断言だけでは設定漏れが下流 SDK の不明瞭な例外になるため、
 * クライアント生成時に原因が分かる固定エラーへ変換します。
 */

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

/** Supabase の公開接続設定が揃っているかを判定します。 */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

/** 検証済みの Supabase 公開接続設定を返します。 */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error('Supabase の接続設定が不足しています');
  }

  return { url, publishableKey };
}
