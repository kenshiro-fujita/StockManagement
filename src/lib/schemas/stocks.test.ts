import { describe, it, expect } from 'vitest';
import { createStockSchema, updateStockSchema } from './stocks';

describe('createStockSchema', () => {
  const validData = {
    stock_code: '7203',
    company_name: 'トヨタ自動車',
  };

  it('必須項目のみで有効なデータを受け付ける', () => {
    const result = createStockSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('全項目入力で有効なデータを受け付ける', () => {
    const result = createStockSchema.safeParse({
      ...validData,
      market: '東証プライム',
      sector: '輸送用機器',
      business_segment: '自動車',
    });
    expect(result.success).toBe(true);
  });

  it('空の銘柄コードを拒否する', () => {
    const result = createStockSchema.safeParse({
      ...validData,
      stock_code: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '銘柄コードを入力してください'
      );
    }
  });

  it('11文字以上の銘柄コードを拒否する', () => {
    const result = createStockSchema.safeParse({
      ...validData,
      stock_code: '12345678901',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '銘柄コードは10文字以内で入力してください'
      );
    }
  });

  it('空の企業名を拒否する', () => {
    const result = createStockSchema.safeParse({
      ...validData,
      company_name: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('企業名を入力してください');
    }
  });

  it('101文字以上の企業名を拒否する', () => {
    const result = createStockSchema.safeParse({
      ...validData,
      company_name: 'あ'.repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '企業名は100文字以内で入力してください'
      );
    }
  });

  it('ちょうど10文字の銘柄コードを受け付ける', () => {
    const result = createStockSchema.safeParse({
      ...validData,
      stock_code: '1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('ちょうど100文字の企業名を受け付ける', () => {
    const result = createStockSchema.safeParse({
      ...validData,
      company_name: 'あ'.repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it('オプション項目が未指定でも受け付ける', () => {
    const result = createStockSchema.safeParse({
      stock_code: '9984',
      company_name: 'ソフトバンクグループ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.market).toBeUndefined();
      expect(result.data.sector).toBeUndefined();
      expect(result.data.business_segment).toBeUndefined();
    }
  });
});

describe('updateStockSchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  const validData = {
    id: validUUID,
    stock_code: '7203',
    company_name: 'トヨタ自動車',
  };

  it('有効なUUID付きデータを受け付ける', () => {
    const result = updateStockSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('全項目入力で有効なデータを受け付ける', () => {
    const result = updateStockSchema.safeParse({
      ...validData,
      market: '東証プライム',
      sector: '輸送用機器',
      business_segment: '自動車',
    });
    expect(result.success).toBe(true);
  });

  it('idが無い場合を拒否する', () => {
    const result = updateStockSchema.safeParse({
      stock_code: '7203',
      company_name: 'トヨタ自動車',
    });
    expect(result.success).toBe(false);
  });

  it('無効なUUID形式を拒否する', () => {
    const result = updateStockSchema.safeParse({
      ...validData,
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('createStockSchemaのバリデーションも継承する', () => {
    const result = updateStockSchema.safeParse({
      id: validUUID,
      stock_code: '',
      company_name: 'トヨタ自動車',
    });
    expect(result.success).toBe(false);
  });
});
