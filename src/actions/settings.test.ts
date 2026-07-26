/**
 * 設定 Server Action が暗号化・永続化層の例外を安全な失敗結果へ変換することを検証します。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveUserSetting: vi.fn(),
}));

vi.mock('@/lib/settings/user-settings', () => ({
  getUserSetting: vi.fn(),
  getAllUserSettings: vi.fn(),
  saveUserSetting: mocks.saveUserSetting,
  isAllowedSettingKey: (key: string) => key === 'edinet_api_key',
}));

import { saveSetting } from '@/actions/settings';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.saveUserSetting.mockReset();
});

describe('saveSetting', () => {
  it('暗号化処理の例外をログへ記録して汎用エラーを返す', async () => {
    const encryptionError = new Error('SETTINGS_ENCRYPTION_KEY is missing');
    mocks.saveUserSetting.mockRejectedValue(encryptionError);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      saveSetting('edinet_api_key', 'secret-value')
    ).resolves.toEqual({
      success: false,
      error: '設定の保存に失敗しました',
    });
    expect(consoleError).toHaveBeenCalledWith(
      'saveSetting failed:',
      encryptionError
    );
  });

  it('許可リスト外のキーは保存層を呼ばずに拒否する', async () => {
    await expect(saveSetting('unexpected_key', 'value')).resolves.toEqual({
      success: false,
      error: '不正な設定キーです',
    });
    expect(mocks.saveUserSetting).not.toHaveBeenCalled();
  });
});
