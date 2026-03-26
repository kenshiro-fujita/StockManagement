import { describe, it, expect } from 'vitest';
import {
  calcEquityRatio,
  calcNetProfitMargin,
  calcOperatingMargin,
  calcROE,
  calcROA,
  calcROIC,
} from './ratios';
import { CALC_VERSION } from '@/lib/types/calc';

describe('calcEquityRatio', () => {
  it('自己資本比率を正しく算出する', () => {
    const result = calcEquityRatio(4_000_000, 10_000_000);
    expect(result.value).toBe(40);
    expect(result.metadata.formula).toBe('自己資本比率 = 自己資本 ÷ 総資産 × 100');
    expect(result.metadata.calcVersion).toBe(CALC_VERSION);
  });

  it('小数点以下第2位を四捨五入する', () => {
    const result = calcEquityRatio(3_333, 10_000);
    expect(result.value).toBe(33.33);
  });

  it('総資産が0の場合はnullを返す', () => {
    const result = calcEquityRatio(1_000, 0);
    expect(result.value).toBeNull();
  });
});

describe('calcNetProfitMargin', () => {
  it('純利益率を正しく算出する', () => {
    const result = calcNetProfitMargin(500_000, 10_000_000);
    expect(result.value).toBe(5);
  });

  it('売上高が0の場合はnullを返す', () => {
    const result = calcNetProfitMargin(500_000, 0);
    expect(result.value).toBeNull();
  });

  it('赤字の場合は負の値を返す', () => {
    const result = calcNetProfitMargin(-200_000, 10_000_000);
    expect(result.value).toBe(-2);
  });
});

describe('calcOperatingMargin', () => {
  it('売上営業利益率を正しく算出する', () => {
    const result = calcOperatingMargin(800_000, 10_000_000);
    expect(result.value).toBe(8);
  });

  it('売上高が0の場合はnullを返す', () => {
    const result = calcOperatingMargin(800_000, 0);
    expect(result.value).toBeNull();
  });
});

describe('calcROE', () => {
  it('ROEを正しく算出する', () => {
    const result = calcROE(500_000, 4_000_000);
    expect(result.value).toBe(12.5);
  });

  it('自己資本が0の場合はnullを返す', () => {
    const result = calcROE(500_000, 0);
    expect(result.value).toBeNull();
  });
});

describe('calcROA', () => {
  it('ROAを正しく算出する', () => {
    const result = calcROA(500_000, 10_000_000);
    expect(result.value).toBe(5);
  });

  it('総資産が0の場合はnullを返す', () => {
    const result = calcROA(500_000, 0);
    expect(result.value).toBeNull();
  });
});

describe('calcROIC', () => {
  it('ROICを正しく算出する', () => {
    // ROIC = 800,000 × (1 - 0.3) ÷ (4,000,000 + 2,000,000) × 100
    // = 560,000 ÷ 6,000,000 × 100 = 9.333...% → 9.33%
    const result = calcROIC(800_000, 0.3, 4_000_000, 2_000_000);
    expect(result.value).toBe(9.33);
  });

  it('投下資本が0の場合はnullを返す', () => {
    const result = calcROIC(800_000, 0.3, 0, 0);
    expect(result.value).toBeNull();
  });

  it('有利子負債が0の場合はequityのみで計算する', () => {
    // ROIC = 800,000 × 0.7 ÷ 4,000,000 × 100 = 14%
    const result = calcROIC(800_000, 0.3, 4_000_000, 0);
    expect(result.value).toBe(14);
  });

  it('メタデータに入力値の参照が含まれる', () => {
    const result = calcROIC(800_000, 0.3, 4_000_000, 2_000_000);
    expect(result.metadata.inputs).toHaveLength(4);
    expect(result.metadata.inputs[0].field).toBe('operating_income');
    expect(result.metadata.inputs[1].field).toBe('tax_rate');
  });
});
