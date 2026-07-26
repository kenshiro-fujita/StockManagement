/**
 * ユーザー設定アクセスの認証・暗号化・DBエラー契約を検証します。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { decryptSettingMock, encryptSettingMock, getAuthenticatedContextMock } =
  vi.hoisted(() => ({
    decryptSettingMock: vi.fn((value: string) => `decrypted:${value}`),
    encryptSettingMock: vi.fn((value: string) => `encrypted:${value}`),
    getAuthenticatedContextMock: vi.fn(),
  }));

vi.mock('@/lib/crypto/settings-cipher', () => ({
  decryptSetting: decryptSettingMock,
  encryptSetting: encryptSettingMock,
}));

vi.mock('@/lib/supabase/auth', () => ({
  getAuthenticatedContext: getAuthenticatedContextMock,
}));

import {
  getAllUserSettings,
  getUserSetting,
  saveUserSetting,
} from '@/lib/settings/user-settings';
import { DataAccessError } from '@/lib/supabase/query-error';

beforeEach(() => {
  decryptSettingMock.mockClear();
  encryptSettingMock.mockClear();
  getAuthenticatedContextMock.mockReset();
});

/** maybeSingleまで連鎖する1件取得クエリを作ります。 */
function singleSettingQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe('getUserSetting', () => {
  it('未認証時はDBへ接続せずnullを返す', async () => {
    getAuthenticatedContextMock.mockResolvedValue(null);

    await expect(getUserSetting('edinet_api_key')).resolves.toBeNull();
  });

  it('保存済みの機密値を復号して返す', async () => {
    const query = singleSettingQuery({
      data: { setting_value: 'ciphertext' },
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };
    getAuthenticatedContextMock.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });

    await expect(getUserSetting('anthropic_api_key')).resolves.toBe(
      'decrypted:ciphertext'
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(query.eq).toHaveBeenNthCalledWith(
      2,
      'setting_key',
      'anthropic_api_key'
    );
  });

  it('DB障害を未設定として扱わず専用エラーを投げる', async () => {
    const query = singleSettingQuery({
      data: null,
      error: new Error('database unavailable'),
    });
    getAuthenticatedContextMock.mockResolvedValue({
      supabase: { from: vi.fn().mockReturnValue(query) },
      user: { id: 'user-1' },
    });

    await expect(getUserSetting('edinet_api_key')).rejects.toBeInstanceOf(
      DataAccessError
    );
  });
});

describe('getAllUserSettings', () => {
  it('許可されたキーだけを復号して返す', async () => {
    const queryResult = {
      data: [
        { setting_key: 'edinet_api_key', setting_value: 'edinet-cipher' },
        { setting_key: 'unexpected_key', setting_value: 'ignored' },
      ],
      error: null,
    };
    const query = {
      select: vi.fn(),
      eq: vi.fn().mockResolvedValue(queryResult),
    };
    query.select.mockReturnValue(query);
    getAuthenticatedContextMock.mockResolvedValue({
      supabase: { from: vi.fn().mockReturnValue(query) },
      user: { id: 'user-1' },
    });

    await expect(getAllUserSettings()).resolves.toEqual({
      edinet_api_key: 'decrypted:edinet-cipher',
    });
  });
});

describe('saveUserSetting', () => {
  it('機密値を暗号化し、認証済みユーザーの行へ保存する', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };
    getAuthenticatedContextMock.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });

    await expect(
      saveUserSetting('anthropic_api_key', 'plain-key')
    ).resolves.toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        setting_key: 'anthropic_api_key',
        setting_value: 'encrypted:plain-key',
      },
      { onConflict: 'user_id,setting_key' }
    );
  });
});
