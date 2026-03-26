import { describe, it, expect } from 'vitest';
import { calcYoYGrowthRate, calcMovingAverageROIC } from './growth';

describe('calcYoYGrowthRate', () => {
  it('正の成長率を正しく算出する', () => {
    const result = calcYoYGrowthRate(1_100_000, 1_000_000, '売上高', 'revenue');
    expect(result.value).toBe(10);
  });

  it('負の成長率を正しく算出する', () => {
    const result = calcYoYGrowthRate(900_000, 1_000_000, '売上高', 'revenue');
    expect(result.value).toBe(-10);
  });

  it('前期が0の場合はnullを返す', () => {
    const result = calcYoYGrowthRate(1_000_000, 0, '売上高', 'revenue');
    expect(result.value).toBeNull();
  });

  it('前期が赤字の場合も絶対値で計算する', () => {
    // (-500,000 - (-1,000,000)) ÷ |-1,000,000| × 100 = 50%
    const result = calcYoYGrowthRate(-500_000, -1_000_000, '純利益', 'net_income');
    expect(result.value).toBe(50);
  });

  it('ラベルがメタデータに含まれる', () => {
    const result = calcYoYGrowthRate(1_100_000, 1_000_000, '売上高', 'revenue');
    expect(result.metadata.formula).toContain('売上高');
  });
});

describe('calcMovingAverageROIC', () => {
  it('複数期のROIC平均を算出する', () => {
    const result = calcMovingAverageROIC([10, 12, 8]);
    expect(result.value).toBe(10);
  });

  it('null値を除外して計算する', () => {
    const result = calcMovingAverageROIC([10, null, 8]);
    expect(result.value).toBe(9);
  });

  it('すべてnullの場合はnullを返す', () => {
    const result = calcMovingAverageROIC([null, null, null]);
    expect(result.value).toBeNull();
  });

  it('空配列の場合はnullを返す', () => {
    const result = calcMovingAverageROIC([]);
    expect(result.value).toBeNull();
  });

  it('小数点以下第2位を四捨五入する', () => {
    const result = calcMovingAverageROIC([10, 11, 12]);
    expect(result.value).toBe(11);
  });
});
