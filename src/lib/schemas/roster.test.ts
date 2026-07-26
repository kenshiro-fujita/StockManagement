import { describe, it, expect } from 'vitest';
import {
  updateRosterSchema,
  updateRatingSchema,
  updateBuyPrioritySchema,
  ROSTER_CATEGORIES,
  ROSTER_CATEGORY_LABELS,
  ROSTER_CATEGORY_SHORT_LABELS,
  ROSTER_BADGE_STYLES,
} from './roster';

describe('updateRosterSchema', () => {
  const validInput = {
    stock_id: '550e8400-e29b-41d4-a716-446655440000',
    category: 'core' as const,
    reason: 'テスト理由',
  };

  it('正常な入力を受け付ける', () => {
    const result = updateRosterSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it.each(ROSTER_CATEGORIES)('カテゴリ "%s" を受け付ける', (category) => {
    const result = updateRosterSchema.safeParse({ ...validInput, category });
    expect(result.success).toBe(true);
  });

  it('無効なカテゴリを拒否する', () => {
    const result = updateRosterSchema.safeParse({
      ...validInput,
      category: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('空の変更理由を拒否する', () => {
    const result = updateRosterSchema.safeParse({
      ...validInput,
      reason: '',
    });
    expect(result.success).toBe(false);
  });

  it('501文字以上の変更理由を拒否する', () => {
    const result = updateRosterSchema.safeParse({
      ...validInput,
      reason: 'あ'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('500文字の変更理由を受け付ける', () => {
    const result = updateRosterSchema.safeParse({
      ...validInput,
      reason: 'あ'.repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it('無効なUUIDを拒否する', () => {
    const result = updateRosterSchema.safeParse({
      ...validInput,
      stock_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateRatingSchema', () => {
  const validInput = {
    stock_id: '550e8400-e29b-41d4-a716-446655440000',
    rating: 3,
  };

  it('正常な評価（1-5）を受け付ける', () => {
    for (let r = 1; r <= 5; r++) {
      const result = updateRatingSchema.safeParse({ ...validInput, rating: r });
      expect(result.success).toBe(true);
    }
  });

  it('0を拒否する', () => {
    const result = updateRatingSchema.safeParse({ ...validInput, rating: 0 });
    expect(result.success).toBe(false);
  });

  it('6を拒否する', () => {
    const result = updateRatingSchema.safeParse({ ...validInput, rating: 6 });
    expect(result.success).toBe(false);
  });

  it('小数を拒否する', () => {
    const result = updateRatingSchema.safeParse({ ...validInput, rating: 3.5 });
    expect(result.success).toBe(false);
  });
});

describe('updateBuyPrioritySchema', () => {
  const validInput = {
    stock_id: '550e8400-e29b-41d4-a716-446655440000',
    buy_priority: 1,
  };

  it('正の整数を受け付ける', () => {
    const result = updateBuyPrioritySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('nullを受け付ける（未設定）', () => {
    const result = updateBuyPrioritySchema.safeParse({
      ...validInput,
      buy_priority: null,
    });
    expect(result.success).toBe(true);
  });

  it('0を拒否する', () => {
    const result = updateBuyPrioritySchema.safeParse({
      ...validInput,
      buy_priority: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('ロースターカテゴリ定数', () => {
  it('全5カテゴリが定義されている', () => {
    expect(ROSTER_CATEGORIES).toHaveLength(5);
  });

  it('全カテゴリにラベルが定義されている', () => {
    for (const cat of ROSTER_CATEGORIES) {
      expect(ROSTER_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it('全カテゴリに略称が定義されている', () => {
    for (const cat of ROSTER_CATEGORIES) {
      expect(ROSTER_CATEGORY_SHORT_LABELS[cat]).toBeTruthy();
    }
  });

  it('全カテゴリにバッジスタイルが定義されている', () => {
    for (const cat of ROSTER_CATEGORIES) {
      expect(ROSTER_BADGE_STYLES[cat].className).toBeTruthy();
    }
  });
});
