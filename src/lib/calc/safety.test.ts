import { describe, it, expect } from 'vitest';
import { calcSafetyMargin, calcSafetyRate, calcIdealBuyPrice } from './safety';

describe('calcSafetyMargin', () => {
  it('割安な場合に正の安全域を返す', () => {
    const result = calcSafetyMargin(2847, 2000, '現状');
    expect(result.value).toBe(847);
  });

  it('割高な場合に負の安全域を返す', () => {
    const result = calcSafetyMargin(2847, 3500, '現状');
    expect(result.value).toBe(-653);
  });

  it('theoryPriceがnullの場合はnullを返す', () => {
    const result = calcSafetyMargin(null, 2000, '現状');
    expect(result.value).toBeNull();
  });

  it('currentStockPriceがnullの場合はnullを返す', () => {
    const result = calcSafetyMargin(2847, null, '現状');
    expect(result.value).toBeNull();
  });

  it('成長込ラベルが正しく設定される', () => {
    const result = calcSafetyMargin(3500, 2000, '成長込');
    expect(result.metadata.formula).toContain('成長込');
  });
});

describe('calcSafetyRate', () => {
  it('安全率を正しく算出する', () => {
    // (2847 - 2000) ÷ 2847 × 100 = 29.75... → 29.75%
    const result = calcSafetyRate(2847, 2000, '現状');
    expect(result.value).toBe(29.75);
  });

  it('割高な場合に負の安全率を返す', () => {
    const result = calcSafetyRate(2847, 3500, '現状');
    // (2847 - 3500) ÷ 2847 × 100 = -22.935... → -22.94
    expect(result.value).toBe(-22.94);
  });

  it('theoryPriceが0の場合はnullを返す', () => {
    const result = calcSafetyRate(0, 2000, '現状');
    expect(result.value).toBeNull();
  });

  it('currentStockPriceがnullの場合はnullを返す', () => {
    const result = calcSafetyRate(2847, null, '現状');
    expect(result.value).toBeNull();
  });
});

describe('calcIdealBuyPrice', () => {
  it('理想購入株価を半値で算出する', () => {
    const result = calcIdealBuyPrice(2847, '現状');
    // 2847 × 0.5 = 1423.5 → floor = 1423
    expect(result.value).toBe(1423);
  });

  it('theoryPriceがnullの場合はnullを返す', () => {
    const result = calcIdealBuyPrice(null, '現状');
    expect(result.value).toBeNull();
  });

  it('カスタム割引係数を使用できる', () => {
    const result = calcIdealBuyPrice(2847, '現状', 0.7);
    // 2847 × 0.7 = 1992.9 → floor = 1992
    expect(result.value).toBe(1992);
  });
});
