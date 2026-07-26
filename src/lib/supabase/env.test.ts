/**
 * Supabase 接続設定の早期検証を確認します。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabasePublicConfig, hasSupabaseEnv } from '@/lib/supabase/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Supabase公開接続設定', () => {
  it('URLと公開キーが揃っていると検証済み設定を返す', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');

    expect(hasSupabaseEnv()).toBe(true);
    expect(getSupabasePublicConfig()).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'publishable-key',
    });
  });

  it('どちらか一方でも欠けていると明示的に失敗する', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');

    expect(hasSupabaseEnv()).toBe(false);
    expect(() => getSupabasePublicConfig()).toThrow(
      'Supabase の接続設定が不足しています'
    );
  });
});
