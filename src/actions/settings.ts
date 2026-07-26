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
import type { ActionResult } from '@/lib/types/action';

export async function saveSetting(
  key: string,
  value: string
): Promise<ActionResult> {
  // Server Action は任意引数で直接 POST できるため、許可リスト外のキーは拒否する
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: '不正な設定キーです' };
  }

  try {
    const result = await saveUserSetting(key, value);
    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error ?? '設定の保存に失敗しました',
    };
  } catch (error) {
    // 暗号化設定の不備などはサーバー側だけへ記録し、内部情報をクライアントへ渡さない。
    console.error('saveSetting failed:', error);
    return { success: false, error: '設定の保存に失敗しました' };
  }
}

export async function getSetting(key: string): Promise<string | null> {
  if (!isAllowedSettingKey(key)) return null;
  return getUserSetting(key);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return getAllUserSettings();
}
