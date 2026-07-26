/**
 * 親銘柄の所有権確認が、対象なしとDB障害を区別することを検証します。
 */
import { describe, expect, it, vi } from 'vitest';
import { checkStockOwnership, findOwnedStock } from '@/lib/supabase/ownership';

/** Supabase の fluent query を必要最小限だけ再現します。 */
function createQuery(result: {
  data: { id: string; stock_code: string } | null;
  error: unknown;
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return query;
}

describe('checkStockOwnership', () => {
  it('銘柄IDとuser_idの両方が一致した行をownedと判定する', async () => {
    const query = createQuery({
      data: { id: 'stock-1', stock_code: '7203' },
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    await expect(
      checkStockOwnership(supabase as never, 'user-1', 'stock-1')
    ).resolves.toBe('owned');
    expect(supabase.from).toHaveBeenCalledWith('stocks');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'stock-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
  });

  it('親子データ照合用に所有銘柄の証券コードも返す', async () => {
    const query = createQuery({
      data: { id: 'stock-1', stock_code: '7203' },
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    await expect(
      findOwnedStock(supabase as never, 'user-1', 'stock-1')
    ).resolves.toEqual({
      status: 'owned',
      stock: { id: 'stock-1', stock_code: '7203' },
    });
  });

  it('行が無い場合はnot_foundと判定する', async () => {
    const query = createQuery({ data: null, error: null });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    await expect(
      checkStockOwnership(supabase as never, 'user-1', 'stock-1')
    ).resolves.toBe('not_found');
  });

  it('DB障害を対象なしに見せずerrorと判定する', async () => {
    const query = createQuery({
      data: null,
      error: new Error('database unavailable'),
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    await expect(
      checkStockOwnership(supabase as never, 'user-1', 'stock-1')
    ).resolves.toBe('error');
  });
});
