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
});
