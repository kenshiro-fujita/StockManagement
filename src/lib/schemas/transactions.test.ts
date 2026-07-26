import { describe, expect, it } from 'vitest';

import { createTransactionSchema } from './transactions';

const validTransaction = {
  stock_id: '550e8400-e29b-41d4-a716-446655440000',
  transaction_type: 'buy' as const,
  trade_date: '2025-02-28',
  quantity: 100,
  unit_price: 1_000,
  fee: 0,
};

describe('createTransactionSchema', () => {
  it('実在する約定日を受け付ける', () => {
    expect(createTransactionSchema.safeParse(validTransaction).success).toBe(
      true
    );
  });

  it('存在しない約定日を拒否する', () => {
    const result = createTransactionSchema.safeParse({
      ...validTransaction,
      trade_date: '2025-02-30',
    });

    expect(result.success).toBe(false);
  });
});
