import { describe, it, expect } from 'vitest';
import { createFinancialDataSchema } from './financial-data';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

const validData = {
  stock_id: validUUID,
  fiscal_year: 2025,
  fiscal_quarter: 'FY' as const,
  consolidation_type: 'consolidated' as const,
  revenue: '1000000',
  operating_income: '100000',
  net_income: '80000',
  total_assets: '5000000',
  equity: '2000000',
  input_unit: 'million' as const,
};

describe('createFinancialDataSchema', () => {
  it('必須項目のみで有効なデータを受け付ける', () => {
    const result = createFinancialDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revenue).toBe(1000000);
      expect(result.data.interest_bearing_debt).toBeUndefined();
    }
  });

  it('全項目入力で有効なデータを受け付ける', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      interest_bearing_debt: '500000',
      operating_cf: '120000',
      investing_cf: '-50000',
      shares_outstanding: '1000000',
      interest_expense: '5000',
      current_stock_price: '1500',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.investing_cf).toBe(-50000);
      expect(result.data.shares_outstanding).toBe(1000000);
    }
  });

  it('カンマ付き数値を受け付ける', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      revenue: '1,234,567',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revenue).toBe(1234567);
    }
  });

  it('空の必須フィールドを拒否する', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      revenue: '',
    });
    expect(result.success).toBe(false);
  });

  it('文字列の金額フィールドを拒否する', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      revenue: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('空のオプションフィールドをundefinedとして受け付ける', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      interest_bearing_debt: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interest_bearing_debt).toBeUndefined();
    }
  });

  it('無効な四半期を拒否する', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      fiscal_quarter: 'Q5',
    });
    expect(result.success).toBe(false);
  });

  it('無効な連結区分を拒否する', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      consolidation_type: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('無効な単位を拒否する', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      input_unit: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('無効な年度（範囲外）を拒否する', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      fiscal_year: 1899,
    });
    expect(result.success).toBe(false);
  });

  it('無効なstock_idを拒否する', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      stock_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('負の値を受け付ける（営業利益の赤字等）', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      operating_income: '-50000',
      net_income: '-30000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.operating_income).toBe(-50000);
      expect(result.data.net_income).toBe(-30000);
    }
  });

  // --- Business logic validation (Story 3.2) ---

  it('売上高が負の値の場合にエラーを返す', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      revenue: '-100',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const revenueError = result.error.issues.find(
        (i) => i.path[0] === 'revenue'
      );
      expect(revenueError?.message).toBe(
        '売上高は0以上の値を入力してください'
      );
    }
  });

  it('売上高が0の場合は受け付ける', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      revenue: '0',
    });
    expect(result.success).toBe(true);
  });

  it('総資産が負の場合にエラーを返す', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      total_assets: '-500000',
      equity: '-600000',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const totalAssetsError = result.error.issues.find(
        (i) => i.path[0] === 'total_assets'
      );
      expect(totalAssetsError?.message).toBe(
        '総資産は0より大きい値を入力してください'
      );
    }
  });

  it('総資産が0の場合にエラーを返す', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      total_assets: '0',
      equity: '0',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const totalAssetsError = result.error.issues.find(
        (i) => i.path[0] === 'total_assets'
      );
      expect(totalAssetsError?.message).toBe(
        '総資産は0より大きい値を入力してください'
      );
    }
  });

  it('自己資本が総資産を超える場合にエラーを返す', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      total_assets: '1000000',
      equity: '2000000',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const equityError = result.error.issues.find(
        (i) => i.path[0] === 'equity'
      );
      expect(equityError?.message).toBe(
        '自己資本が総資産を超えています。入力値を確認してください'
      );
    }
  });

  it('自己資本が総資産と等しい場合は受け付ける', () => {
    const result = createFinancialDataSchema.safeParse({
      ...validData,
      total_assets: '5000000',
      equity: '5000000',
    });
    expect(result.success).toBe(true);
  });
});
