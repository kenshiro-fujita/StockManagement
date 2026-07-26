/**
 * 理論株価の算出関数群（スプレッドシート方式）
 *
 * 2系統の理論株価を算出する:
 * 【現状理論株価＝資産＋事業価値方式（グレアム型）】
 *   1. 事業価値 = 営業利益 × 事業価値倍率（cap_multiplier、既定10）
 *   2. 財産価値 = 流動資産 − 流動負債 × 1.2 + 投資その他の資産
 *   3. 現状理論株価 = (事業価値 + 財産価値) ÷ 発行済株式数
 *      ※ 有利子負債は控除しない（流動負債×1.2 で負債を保守的に見込む方式のため）
 *
 * 【成長込理論株価＝PER割引方式】
 *   1. 理論PER = 1 ÷ (r − g)
 *   2. 5年後理論時価総額 = 6年目当期純利益予測 × 理論PER
 *   3. 理論時価総額 = 5年後理論時価総額 ÷ (1+r)^5
 *   4. 成長込理論株価 = 理論時価総額 ÷ 発行済株式数
 */
import type { CalcResult } from '@/lib/types/calc';
import { CALC_VERSION } from '@/lib/types/calc';
import { roundYen, truncateYen, roundPercent } from './utils';

/**
 * 事業価値 = 営業利益 × 事業価値倍率（cap_multiplier、既定10倍）
 * スプシ方式では税引き・DCF を行わず、営業利益の単純倍率で事業価値とする。
 */
export function calcBusinessValue(
  operatingIncome: number,
  capMultiplier: number,
): CalcResult<number> {
  return {
    value: roundYen(operatingIncome * capMultiplier),
    metadata: {
      formula: '事業価値 = 営業利益 × 事業価値倍率',
      inputs: [
        { label: '営業利益', value: operatingIncome, field: 'operating_income' },
        { label: '事業価値倍率', value: capMultiplier, field: 'cap_multiplier' },
      ],
      rounding: '円未満四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/**
 * 財産価値 = 流動資産 − 流動負債 × 1.2 + 投資その他の資産
 * 流動負債に1.2を掛けることで負債を保守的に見込む（グレアム型の純財産評価）。
 * いずれかが未入力（null）なら算出不可。
 */
export function calcAssetValue(
  currentAssets: number | null,
  currentLiabilities: number | null,
  investmentsAndOtherAssets: number | null,
): CalcResult<number> {
  const value =
    currentAssets == null || currentLiabilities == null || investmentsAndOtherAssets == null
      ? null
      : roundYen(currentAssets - currentLiabilities * 1.2 + investmentsAndOtherAssets);
  return {
    value,
    metadata: {
      formula: '財産価値 = 流動資産 − 流動負債 × 1.2 + 投資その他の資産',
      inputs: [
        { label: '流動資産', value: currentAssets ?? 0, field: 'current_assets' },
        { label: '流動負債', value: currentLiabilities ?? 0, field: 'current_liabilities' },
        { label: '投資その他の資産', value: investmentsAndOtherAssets ?? 0, field: 'investments_and_other_assets' },
      ],
      rounding: '円未満四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/**
 * 現状理論株価 = (事業価値 + 財産価値) ÷ 発行済株式数
 * 円未満切捨て。有利子負債は控除しない（財産価値の流動負債×1.2 で負債を見込むため）。
 */
export function calcTheoryPrice(
  businessValue: number,
  assetValue: number,
  sharesOutstanding: number | null,
): CalcResult<number> {
  const value =
    sharesOutstanding == null || sharesOutstanding === 0
      ? null
      : truncateYen((businessValue + assetValue) / sharesOutstanding);
  return {
    value,
    metadata: {
      formula: '現状理論株価 = (事業価値 + 財産価値) ÷ 発行済株式数',
      inputs: [
        { label: '事業価値', value: businessValue, field: 'business_value（算出値）' },
        { label: '財産価値', value: assetValue, field: 'asset_value（算出値）' },
        { label: '発行済株式数', value: sharesOutstanding ?? 0, field: 'shares_outstanding' },
      ],
      rounding: '円未満切捨て',
      calcVersion: CALC_VERSION,
    },
  };
}

/**
 * 成長込理論株価（PER割引方式）
 *   理論PER = 1/(r−g) → 5年後理論時価総額 = 6年目純利益予測 × 理論PER
 *   → 理論時価総額 = 5年後 ÷ (1+r)^5 → ÷ 発行済株式数
 * 6年目純利益予測が未入力、r−g≤0、株式数なしの場合は算出不可。
 */
export function calcGrowthTheoryPrice(
  projectedNetIncome: number | null,
  discountRate: number,
  growthRate: number,
  sharesOutstanding: number | null,
): CalcResult<number> {
  const rMinusG = discountRate - growthRate;
  const baseInputs = [
    { label: '6年目純利益予測', value: projectedNetIncome ?? 0, field: 'projected_net_income' },
    { label: '割引率', value: discountRate, field: 'discount_rate' },
    { label: '成長率', value: growthRate, field: 'growth_rate' },
    { label: '発行済株式数', value: sharesOutstanding ?? 0, field: 'shares_outstanding' },
  ];

  if (
    projectedNetIncome == null ||
    rMinusG <= 0 ||
    sharesOutstanding == null ||
    sharesOutstanding === 0
  ) {
    return {
      value: null,
      metadata: {
        formula: '成長込理論株価 = 6年目純利益予測 × 1/(r−g) ÷ (1+r)^5 ÷ 発行済株式数（算出不可）',
        inputs: baseInputs,
        rounding: '円未満切捨て',
        calcVersion: CALC_VERSION,
      },
    };
  }

  const theoryPER = 1 / rMinusG;
  const futureMarketCap = projectedNetIncome * theoryPER; // 5年後理論時価総額
  const presentMarketCap = futureMarketCap / Math.pow(1 + discountRate, 5);
  const value = truncateYen(presentMarketCap / sharesOutstanding);

  return {
    value,
    metadata: {
      formula: '成長込理論株価 = 6年目純利益予測 × 1/(r−g) ÷ (1+r)^5 ÷ 発行済株式数',
      inputs: baseInputs,
      rounding: '円未満切捨て',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 理論時価総額 = 理論株価 × 発行済株式数 */
export function calcTheoryMarketCap(
  theoryPrice: number | null,
  sharesOutstanding: number | null,
): CalcResult<number> {
  const value =
    theoryPrice == null || sharesOutstanding == null
      ? null
      : roundYen(theoryPrice * sharesOutstanding);
  return {
    value,
    metadata: {
      formula: '理論時価総額 = 理論株価 × 発行済株式数',
      inputs: [
        { label: '理論株価', value: theoryPrice ?? 0, field: 'theory_price（算出値）' },
        { label: '発行済株式数', value: sharesOutstanding ?? 0, field: 'shares_outstanding' },
      ],
      rounding: '円未満四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 理論PER = 理論時価総額 ÷ 純利益（倍） */
export function calcTheoryPER(
  theoryMarketCap: number | null,
  netIncome: number,
): CalcResult<number> {
  const value =
    theoryMarketCap == null || netIncome === 0
      ? null
      : roundPercent(theoryMarketCap / netIncome);
  return {
    value,
    metadata: {
      formula: '理論PER = 理論時価総額 ÷ 純利益',
      inputs: [
        { label: '理論時価総額', value: theoryMarketCap ?? 0, field: 'theory_market_cap（算出値）' },
        { label: '純利益', value: netIncome, field: 'net_income' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 5年後理論時価総額 = 理論時価総額 × (1 + g)^5 */
export function calcFutureTheoryMarketCap(
  theoryMarketCap: number | null,
  growthRate: number,
  years: number = 5,
): CalcResult<number> {
  const value =
    theoryMarketCap == null
      ? null
      : roundYen(theoryMarketCap * Math.pow(1 + growthRate, years));
  return {
    value,
    metadata: {
      formula: `${years}年後理論時価総額 = 理論時価総額 × (1+g)^${years}`,
      inputs: [
        { label: '理論時価総額', value: theoryMarketCap ?? 0, field: 'theory_market_cap（算出値）' },
        { label: '成長率', value: growthRate, field: 'growth_rate' },
      ],
      rounding: '円未満四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 6年目当期純利益 = 純利益 × (1+g)^5 */
export function calcFutureNetIncome(
  netIncome: number,
  growthRate: number,
  years: number = 5,
): CalcResult<number> {
  const value = roundYen(netIncome * Math.pow(1 + growthRate, years));
  return {
    value,
    metadata: {
      formula: `${years + 1}年目当期純利益 = 純利益 × (1+g)^${years}`,
      inputs: [
        { label: '純利益', value: netIncome, field: 'net_income' },
        { label: '成長率', value: growthRate, field: 'growth_rate' },
      ],
      rounding: '円未満四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}
