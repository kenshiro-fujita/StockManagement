import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { decryptSetting, encryptSetting } from './settings-cipher';

describe('settings cipher', () => {
  beforeEach(() => {
    vi.stubEnv(
      'SETTINGS_ENCRYPTION_KEY',
      Buffer.alloc(32, 7).toString('base64')
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('暗号化した設定値を元の文字列へ復号する', () => {
    const encrypted = encryptSetting('secret-api-key');

    expect(encrypted).not.toBe('secret-api-key');
    expect(decryptSetting(encrypted)).toBe('secret-api-key');
  });

  it('暗号化導入前の平文を後方互換で扱う', () => {
    expect(decryptSetting('legacy-plain-value')).toBe('legacy-plain-value');
  });

  it('壊れた暗号化値を明示的に拒否する', () => {
    expect(() => decryptSetting('enc:v1:broken')).toThrow(
      '暗号化済み設定値の形式が不正です'
    );
  });
});
