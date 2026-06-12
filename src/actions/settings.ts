/**
 * ユーザー設定の Server Actions
 *
 * 実体は lib/settings/user-settings.ts（暗号化・許可リスト検証込み）に委譲する。
 * クライアントから直接呼ばれる入口なので、key の許可リスト検証をここでも行い、
 * 任意の setting_key を書き込まれる攻撃（例: 想定外キーの混入）を防ぐ。
 */
'use server';

import {
  getUserSetting,
  getAllUserSettings,
  saveUserSetting,
  isAllowedSettingKey,
} from '@/lib/settings/user-settings';

export async function saveSetting(
  key: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  // Server Action は任意引数で直接 POST できるため、許可リスト外のキーは拒否する
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: '不正な設定キーです' };
  }
  return saveUserSetting(key, value);
}

export async function getSetting(key: string): Promise<string | null> {
  if (!isAllowedSettingKey(key)) return null;
  return getUserSetting(key);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return getAllUserSettings();
}
