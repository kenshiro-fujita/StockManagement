/**
 * 一覧系画面が共有する指標入力整形の契約を検証します。
 */
import { describe, expect, it } from 'vitest';
import {
  calculateStockIndicators,
  calculateStockIndicatorSummary,
  groupByStockId,
  indexParametersByStockId,
  normalizeParameters,
} from '@/lib/stocks/indicator-data';

describe('groupByStockId', () => {
  it('入力順を保ったまま銘柄ごとに行をまとめる', () => {
    const grouped = groupByStockId([
      { stock_id: 'stock-a', year: 2025 },
      { stock_id: 'stock-b', year: 2025 },
      { stock_id: 'stock-a', year: 2024 },
    ]);

    expect(grouped.get('stock-a')).toEqual([
      { stock_id: 'stock-a', year: 2025 },
      { stock_id: 'stock-a', year: 2024 },
    ]);
    expect(grouped.get('stock-b')).toEqual([
      { stock_id: 'stock-b', year: 2025 },
    ]);
  });

  it('空配列から空のMapを返す', () => {
    expect(groupByStockId([]).size).toBe(0);
  });
});

describe('parameter normalization', () => {
  const rawParameters = {
    id: 'parameter-id',
    stock_id: 'stock-id',
    discount_rate: '0.08',
    growth_rate: '0.02',
    tax_rate: '0.3',
    cap_multiplier: '10',
  };

  it('DBのNUMERIC文字列を計算可能なnumberへ変換する', () => {
    expect(normalizeParameters(rawParameters)).toEqual({
      id: 'parameter-id',
      stock_id: 'stock-id',
      discount_rate: 0.08,
      growth_rate: 0.02,
      tax_rate: 0.3,
      cap_multiplier: 10,
    });
  });

  it('銘柄IDで参照できるMapを返す', () => {
    expect(indexParametersByStockId([rawParameters]).get('stock-id')).toEqual(
      normalizeParameters(rawParameters)
    );
  });
});

describe('calculateStockIndicatorSummary', () => {
  it('財務データがない場合は算出不能としてnullを返す', () => {
    expect(calculateStockIndicators([], null)).toBeNull();
    expect(calculateStockIndicatorSummary([], null)).toEqual({
      theoryPrice: null,
      safetyRateCurrent: null,
    });
  });
});
