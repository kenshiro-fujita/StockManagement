/**
 * 銘柄更新後に依存する全画面のキャッシュが無効化されることを検証します。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { revalidateStockPaths } from '@/lib/revalidate';

describe('revalidateStockPaths', () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
  });

  it('銘柄横断の一覧・比較・ポートフォリオを常に無効化する', () => {
    revalidateStockPaths();

    expect(revalidatePathMock.mock.calls).toEqual([
      ['/stocks'],
      ['/stocks/compare'],
      ['/stocks/portfolio'],
    ]);
  });

  it('銘柄IDがあれば詳細ページも無効化する', () => {
    revalidateStockPaths('550e8400-e29b-41d4-a716-446655440000');

    expect(revalidatePathMock).toHaveBeenLastCalledWith(
      '/stocks/550e8400-e29b-41d4-a716-446655440000'
    );
    expect(revalidatePathMock).toHaveBeenCalledTimes(4);
  });
});
