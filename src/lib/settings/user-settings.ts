/**
 * ユーザー設定（user_settings テーブル）への共通アクセス層
 *
 * Server Actions（src/actions/settings.ts）と lib 内のコード（EDINET クライアント、
 * AI プロバイダ等）の両方から使う。lib → actions の依存方向逆転を避けるため、
 * DB アクセスの実体をここ（lib）に置き、actions は薄いラッパーにする。
 *
 * セキュリティ方針:
 * - setting_key は許可リスト方式（任意キーの書き込みを防ぐ）
 * - APIキー等の機密キーは AES-256-GCM で暗号化して保存（settings-cipher 参照）
 */
import { encryptSetting, decryptSetting } from '@/lib/crypto/settings-cipher';
import { getAuthenticatedContext } from '@/lib/supabase/auth';
import { DataAccessError } from '@/lib/supabase/query-error';

/** 保存を許可する設定キーの一覧（これ以外は拒否する） */
export const ALLOWED_SETTING_KEYS = [
  'edinet_api_key',
  'anthropic_api_key',
] as const;
export type SettingKey = (typeof ALLOWED_SETTING_KEYS)[number];

/** 暗号化して保存すべき機密キー（現状は全キーが機密だが、将来の非機密設定に備えて分離） */
const SECRET_SETTING_KEYS: ReadonlySet<SettingKey> = new Set([
  'edinet_api_key',
  'anthropic_api_key',
]);

/** key が許可リストに含まれるかを判定する型ガード */
export function isAllowedSettingKey(key: string): key is SettingKey {
  return (ALLOWED_SETTING_KEYS as readonly string[]).includes(key);
}

/**
 * 現在のユーザーの設定値を1件取得する（機密キーは復号して返す）。
 * 未認証・未設定はどちらも null。
 */
export async function getUserSetting(key: SettingKey): Promise<string | null> {
  const context = await getAuthenticatedContext();
  if (!context) return null;
  const { supabase, user } = context;

  const { data, error } = await supabase
    .from('user_settings')
    .select('setting_value')
    .eq('user_id', user.id)
    .eq('setting_key', key)
    .maybeSingle();

  if (error) {
    throw new DataAccessError('ユーザー設定の取得', [error]);
  }

  const stored = data?.setting_value ?? null;
  if (stored == null) return null;
  return SECRET_SETTING_KEYS.has(key) ? decryptSetting(stored) : stored;
}

/** 現在のユーザーの全設定を取得する（機密キーは復号して返す） */
export async function getAllUserSettings(): Promise<Record<string, string>> {
  const context = await getAuthenticatedContext();
  if (!context) return {};
  const { supabase, user } = context;

  const { data, error } = await supabase
    .from('user_settings')
    .select('setting_key, setting_value')
    .eq('user_id', user.id);

  if (error) {
    throw new DataAccessError('ユーザー設定の取得', [error]);
  }

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!isAllowedSettingKey(row.setting_key)) {
      continue;
    }

    result[row.setting_key] = SECRET_SETTING_KEYS.has(row.setting_key)
      ? decryptSetting(row.setting_value)
      : row.setting_value;
  }
  return result;
}

/** 現在のユーザーの設定値を保存する（機密キーは暗号化して保存） */
export async function saveUserSetting(
  key: SettingKey,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const context = await getAuthenticatedContext();
  if (!context) return { success: false, error: '認証が必要です' };
  const { supabase, user } = context;

  const storedValue = SECRET_SETTING_KEYS.has(key)
    ? encryptSetting(value)
    : value;

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, setting_key: key, setting_value: storedValue },
      { onConflict: 'user_id,setting_key' }
    );

  if (error) {
    return { success: false, error: '設定の保存に失敗しました' };
  }
  return { success: true };
}
