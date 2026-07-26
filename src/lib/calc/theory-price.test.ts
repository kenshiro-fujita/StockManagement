/**
 * スプレッドシート方式の理論株価計算を単体で固定するテスト。
 *
 * 端数処理・未入力・発散条件を関数境界ごとに検証し、統合テストの差分原因を
 * 特定しやすくするため、計算チェーンを小さく分けて確認する。
 */
import { describe, expect, it } from 'vitest';
import {
  calcAssetValue,
  calcBusinessValue,
  calcFutureNetIncome,
  calcFutureTheoryMarketCap,
  calcGrowthTheoryPrice,
  calcTheoryMarketCap,
  calcTheoryPER,
  calcTheoryPrice,
} from './theory-price';

describe('calcBusinessValue', () => {
  it('営業利益に事業価値倍率を掛ける', () => {
    const result = calcBusinessValue(100_000, 10);
    expect(result.value).toBe(1_000_000);
    expect(result.metadata.formula).toBe('事業価値 = 営業利益 × 事業価値倍率');
  });
});

describe('calcAssetValue', () => {
  it('流動負債を1.2倍して財産価値を算出する', () => {
    const result = calcAssetValue(800_000, 300_000, 200_000);
    expect(result.value).toBe(640_000);
  });

  it.each([
    [null, 300_000, 200_000],
    [800_000, null, 200_000],
    [800_000, 300_000, null],
  ])('必要な入力が欠ける場合はnullを返す', (currentAssets, currentLiabilities, investments) => {
    expect(calcAssetValue(currentAssets, currentLiabilities, investments).value).toBeNull();
  });
});

describe('calcTheoryPrice', () => {
  it('事業価値と財産価値を合算し円未満を切り捨てる', () => {
    expect(calcTheoryPrice(1_000_001, 500_000, 1_000).value).toBe(1500);
  });

  it.each([null, 0])('発行済株式数が%sの場合はnullを返す', (shares) => {
    expect(calcTheoryPrice(1_000_000, 500_000, shares).value).toBeNull();
  });
});

describe('calcGrowthTheoryPrice', () => {
  it('6年目純利益予測を理論PERで評価し5年分割り引く', () => {
    const expected = Math.trunc(5_000_000_000 * (1 / 0.06) / Math.pow(1.08, 5) / 100_000_000);
    expect(calcGrowthTheoryPrice(5_000_000_000, 0.08, 0.02, 100_000_000).value).toBe(expected);
  });

  it('6年目純利益予測が未入力の場合はnullを返す', () => {
    expect(calcGrowthTheoryPrice(null, 0.08, 0.02, 100_000_000).value).toBeNull();
  });

  it('割引率が成長率以下の場合はnullを返す', () => {
    expect(calcGrowthTheoryPrice(5_000_000_000, 0.02, 0.02, 100_000_000).value).toBeNull();
  });

  it.each([null, 0])('発行済株式数が%sの場合はnullを返す', (shares) => {
    expect(calcGrowthTheoryPrice(5_000_000_000, 0.08, 0.02, shares).value).toBeNull();
  });
});

describe('派生指標', () => {
  it('理論時価総額を算出する', () => {
    expect(calcTheoryMarketCap(2847, 10_000_000).value).toBe(28_470_000_000);
  });

  it('理論株価がnullの場合は理論時価総額もnullを返す', () => {
    expect(calcTheoryMarketCap(null, 10_000_000).value).toBeNull();
  });

  it('理論PERを算出する', () => {
    expect(calcTheoryPER(28_470_000_000, 2_000_000_000).value).toBe(14.24);
  });

  it('純利益が0の場合は理論PERをnullにする', () => {
    expect(calcTheoryPER(28_470_000_000, 0).value).toBeNull();
  });

  it('5年後理論時価総額を算出する', () => {
    const expected = Math.round(28_470_000_000 * Math.pow(1.02, 5));
    expect(calcFutureTheoryMarketCap(28_470_000_000, 0.02, 5).value).toBe(expected);
  });

  it('6年目当期純利益を算出する', () => {
    const expected = Math.round(2_000_000_000 * Math.pow(1.02, 5));
    expect(calcFutureNetIncome(2_000_000_000, 0.02, 5).value).toBe(expected);
  });
});
