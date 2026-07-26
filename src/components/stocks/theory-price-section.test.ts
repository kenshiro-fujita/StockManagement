import { describe, it, expect } from 'vitest';
import { getValuationLevel } from '@/lib/calc/safety';
import { detectChangedFields } from './theory-price-section';
import type { IndicatorResults, CalcResult } from '@/lib/types/calc';

describe('getValuationLevel', () => {
  it('null の場合は null を返す', () => {
    expect(getValuationLevel(null)).toBe(null);
  });

  it('正の安全率は「割安」を返す', () => {
    expect(getValuationLevel(10)).toBe('cheap');
    expect(getValuationLevel(0.01)).toBe('cheap');
    expect(getValuationLevel(50)).toBe('cheap');
  });

  it('0% は「適正」を返す', () => {
    expect(getValuationLevel(0)).toBe('fair');
  });

  it('-10% 〜 0% は「適正」を返す', () => {
    expect(getValuationLevel(-5)).toBe('fair');
    expect(getValuationLevel(-10)).toBe('fair');
  });

  it('-10% 未満は「割高」を返す', () => {
    expect(getValuationLevel(-10.01)).toBe('expensive');
    expect(getValuationLevel(-50)).toBe('expensive');
  });
});

// ---------- detectChangedFields ----------

/** ダミーの CalcResult を生成するヘルパー */
function calc(value: number | null): CalcResult<number> {
  return {
    value,
    metadata: {
      formula: 'test',
      inputs: [],
      rounding: 'none',
      calcVersion: 'v1.0.0',
    },
  };
}

/** PeriodIndicators の全フィールドを指定値で埋めたオブジェクトを生成 */
function makePeriod(overrides: Record<string, number | null> = {}) {
  const defaults: Record<string, number | null> = {
    equityRatio: 50,
    netProfitMargin: 10,
    operatingMargin: 15,
    revenueGrowthRate: 5,
    netIncomeGrowthRate: 8,
    operatingCF: 1000,
    investingCF: -500,
    fcf: 500,
    roe: 12,
    roa: 6,
    roic: 10,
    eps: 100,
    per: 15,
    pbr: 1.5,
    businessValue: 50000,
    assetValue: 30000,
    theoryPrice: 2000,
    growthTheoryPrice: 2500,
    theoryPER: 18,
    theoryMarketCap: 100000,
    futureTheoryMarketCap: 150000,
    futureNetIncome: 8000,
    safetyMarginCurrent: 500,
    safetyMarginGrowth: 1000,
    safetyRateCurrent: 25,
    safetyRateGrowth: 50,
    idealBuyPriceCurrent: 1500,
    idealBuyPriceGrowth: 1250,
  };
  const merged = { ...defaults, ...overrides };
  const period: Record<string, CalcResult<number>> = {};
  for (const [key, val] of Object.entries(merged)) {
    period[key] = calc(val);
  }
  return period;
}

function makeResults(
  periodOverrides: Record<string, number | null> = {},
  movingAvgROIC: number | null = 9
): IndicatorResults {
  return {
    period: makePeriod(
      periodOverrides
    ) as unknown as IndicatorResults['period'],
    movingAverageROIC: calc(movingAvgROIC),
  };
}

describe('detectChangedFields', () => {
  it('prev が null の場合は空の Set を返す', () => {
    const result = detectChangedFields(null, makeResults());
    expect(result.size).toBe(0);
  });

  it('current が null の場合は空の Set を返す', () => {
    const result = detectChangedFields(makeResults(), null);
    expect(result.size).toBe(0);
  });

  it('同一の結果同士では変更なし', () => {
    const results = makeResults();
    const result = detectChangedFields(results, results);
    expect(result.size).toBe(0);
  });

  it('period の値が変わったフィールドを検出する', () => {
    const prev = makeResults();
    const current = makeResults({ theoryPrice: 2200, roe: 14 });
    const changed = detectChangedFields(prev, current);
    expect(changed.has('theoryPrice')).toBe(true);
    expect(changed.has('roe')).toBe(true);
    expect(changed.has('eps')).toBe(false);
    expect(changed.size).toBe(2);
  });

  it('movingAverageROIC の変更を検出する', () => {
    const prev = makeResults({}, 9);
    const current = makeResults({}, 11);
    const changed = detectChangedFields(prev, current);
    expect(changed.has('movingAverageROIC')).toBe(true);
    expect(changed.size).toBe(1);
  });

  it('period と movingAverageROIC の両方が変わった場合は両方検出する', () => {
    const prev = makeResults({ growthTheoryPrice: 2500 }, 9);
    const current = makeResults({ growthTheoryPrice: 3000 }, 12);
    const changed = detectChangedFields(prev, current);
    expect(changed.has('growthTheoryPrice')).toBe(true);
    expect(changed.has('movingAverageROIC')).toBe(true);
    expect(changed.size).toBe(2);
  });
});
