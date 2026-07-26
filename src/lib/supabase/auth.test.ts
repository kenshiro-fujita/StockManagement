/**
 * 認証済み Server Action コンテキストの正規化を検証します。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import { getAuthenticatedContext } from '@/lib/supabase/auth';

describe('getAuthenticatedContext', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('Supabaseが検証したユーザーと同じリクエストクライアントを返す', async () => {
    const user = { id: 'user-1' };
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
    };
    createClientMock.mockResolvedValue(supabase);

    await expect(getAuthenticatedContext()).resolves.toEqual({
      supabase,
      user,
    });
  });

  it('未認証ユーザーをnullへ正規化する', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    await expect(getAuthenticatedContext()).resolves.toBeNull();
  });

  it('認証検証エラーの詳細を公開せずnullへ正規化する', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('provider detail'),
        }),
      },
    });

    await expect(getAuthenticatedContext()).resolves.toBeNull();
  });
});
