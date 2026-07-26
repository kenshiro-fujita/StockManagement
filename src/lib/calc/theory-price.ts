/**
 * 理論株価の算出関数群（山口揚平氏の手法ベース）
 *
 * 計算の流れ:
 * 1. 事業価値 = 営業利益 × (1-税率) ÷ (r-g)  ← DCF の永久成長モデル
 *    ただし r≦g だと発散するため、上限倍率（cap_multiplier）で制限する
 * 2. 資産価値 = 自己資本（簡易的に株主資本＝清算価値と近似）
 * 3. 理論株価 = (事業価値 + 資産価値 - 有利子負債) ÷ 発行済株式数
 * 4. 成長込理論株価 = 上限倍率を適用せず DCF のみで計算した理論株価
 * 5. 理論PER、将来時価総額、将来純利益 は理論株価から派生
 */
import type { CalcResult } from '@/lib/types/calc';
import { roundYen, truncateYen, roundToTwoDecimals } from './utils';
import { createCalcResult, ROUNDING_RULE } from './result';

/**
 * 事業価値 = 営業利益 × (1-実効税率) ÷ (r-g)（DCF 永久成長モデル）
 *
 * r-g が 0 以下だとDCF式が発散するため、null を返す。
 * また、DCF 値が大きくなりすぎないよう、上限倍率（cap_multiplier）を適用する。
 * 上限値 = 営業利益 × cap_multiplier × (1-実効税率)
 * 最終的な事業価値 = min(DCF値, 上限値)
 */
export function calcBusinessValue(
  operatingIncome: number,
  taxRate: number,
  discountRate: number,
  growthRate: number,
  capMultiplier: number
): CalcResult<number> {
  const afterTaxIncome = operatingIncome * (1 - taxRate);
  const rMinusG = discountRate - growthRate;

  if (rMinusG <= 0) {
    return createCalcResult<number>(null, {
      formula:
        '事業価値 = 営業利益 × (1-実効税率) ÷ (r-g)（r ≤ g のため算出不可）',
      inputs: [
        {
          label: '営業利益',
          value: operatingIncome,
          field: 'operating_income',
        },
        { label: '実効税率', value: taxRate, field: 'tax_rate' },
        { label: '割引率', value: discountRate, field: 'discount_rate' },
        { label: '成長率', value: growthRate, field: 'growth_rate' },
      ],
      rounding: ROUNDING_RULE.yen,
    });
  }

  const dcfValue = afterTaxIncome / rMinusG;
  const capValue = operatingIncome * capMultiplier * (1 - taxRate);
  const value = roundYen(Math.min(dcfValue, capValue));
  const capped = capValue < dcfValue;

  return createCalcResult(value, {
    formula: capped
      ? '事業価値 = 営業利益 × 上限倍率 × (1-実効税率)（上限倍率適用）'
      : '事業価値 = 営業利益 × (1-実効税率) ÷ (r-g)',
    inputs: [
      { label: '営業利益', value: operatingIncome, field: 'operating_income' },
      { label: '実効税率', value: taxRate, field: 'tax_rate' },
      { label: '割引率', value: discountRate, field: 'discount_rate' },
      { label: '成長率', value: growthRate, field: 'growth_rate' },
      { label: '上限倍率', value: capMultiplier, field: 'cap_multiplier' },
    ],
    rounding: ROUNDING_RULE.yen,
  });
}

/**
 * 現状資産価値 = 自己資本
 * equityField/equityLabel は呼び出し側（resolveEquity）が解決した
 * 「実際にどのカラムを使ったか」を計算根拠表示に残すための情報
 */
export function calcAssetValue(
  equity: number,
  equityField: string = 'equity',
  equityLabel: string = '自己資本'
): CalcResult<number> {
  return createCalcResult(equity, {
    formula: '資産価値 = 自己資本（株主資本優先、なければ純資産）',
    inputs: [{ label: equityLabel, value: equity, field: equityField }],
    rounding: ROUNDING_RULE.inputValue,
  });
}

/**
 * 現状理論株価 = (事業価値 + 資産価値 - 有利子負債) ÷ 発行済株式数
 * 円未満を0方向へ切捨てる（スプレッドシートの ROUNDDOWN と同じ挙動）
 */
export function calcTheoryPrice(
  businessValue: number,
  assetValue: number,
  interestBearingDebt: number,
  sharesOutstanding: number | null
): CalcResult<number> {
  const value =
    sharesOutstanding == null || sharesOutstanding === 0
      ? null
      : truncateYen(
          (businessValue + assetValue - interestBearingDebt) / sharesOutstanding
        );
  return createCalcResult(value, {
    formula: '理論株価 = (事業価値 + 資産価値 - 有利子負債) ÷ 発行済株式数',
    inputs: [
      {
        label: '事業価値',
        value: businessValue,
        field: 'business_value（算出値）',
      },
      { label: '資産価値', value: assetValue, field: 'asset_value（算出値）' },
      {
        label: '有利子負債',
        value: interestBearingDebt,
        field: 'interest_bearing_debt',
      },
      {
        label: '発行済株式数',
        value: sharesOutstanding ?? 0,
        field: 'shares_outstanding',
      },
    ],
    rounding: ROUNDING_RULE.truncateYen,
  });
}

/**
 * 成長込理論株価 — 上限倍率を適用せず、DCF 式のみで事業価値を算出した場合の理論株価
 * 成長率 g をフルに反映する
 */
export function calcGrowthTheoryPrice(
  operatingIncome: number,
  taxRate: number,
  discountRate: number,
  growthRate: number,
  equity: number,
  interestBearingDebt: number,
  sharesOutstanding: number | null
): CalcResult<number> {
  const rMinusG = discountRate - growthRate;
  if (rMinusG <= 0 || sharesOutstanding == null || sharesOutstanding === 0) {
    return createCalcResult<number>(null, {
      formula:
        '成長込理論株価 = (事業価値DCF + 資産価値 - 有利子負債) ÷ 発行済株式数',
      inputs: [
        {
          label: '営業利益',
          value: operatingIncome,
          field: 'operating_income',
        },
        { label: '割引率', value: discountRate, field: 'discount_rate' },
        { label: '成長率', value: growthRate, field: 'growth_rate' },
      ],
      rounding: ROUNDING_RULE.truncateYen,
    });
  }

  const businessValueDCF = (operatingIncome * (1 - taxRate)) / rMinusG;
  const value = truncateYen(
    (businessValueDCF + equity - interestBearingDebt) / sharesOutstanding
  );
  return createCalcResult(value, {
    formula:
      '成長込理論株価 = (営業利益×(1-実効税率)÷(r-g) + 資産価値 - 有利子負債) ÷ 発行済株式数',
    inputs: [
      { label: '営業利益', value: operatingIncome, field: 'operating_income' },
      { label: '実効税率', value: taxRate, field: 'tax_rate' },
      { label: '割引率', value: discountRate, field: 'discount_rate' },
      { label: '成長率', value: growthRate, field: 'growth_rate' },
      { label: '自己資本', value: equity, field: 'equity' },
      {
        label: '有利子負債',
        value: interestBearingDebt,
        field: 'interest_bearing_debt',
      },
      {
        label: '発行済株式数',
        value: sharesOutstanding,
        field: 'shares_outstanding',
      },
    ],
    rounding: ROUNDING_RULE.truncateYen,
  });
}

/** 理論時価総額 = 理論株価 × 発行済株式数 */
export function calcTheoryMarketCap(
  theoryPrice: number | null,
  sharesOutstanding: number | null
): CalcResult<number> {
  const value =
    theoryPrice == null || sharesOutstanding == null
      ? null
      : roundYen(theoryPrice * sharesOutstanding);
  return createCalcResult(value, {
    formula: '理論時価総額 = 理論株価 × 発行済株式数',
    inputs: [
      {
        label: '理論株価',
        value: theoryPrice ?? 0,
        field: 'theory_price（算出値）',
      },
      {
        label: '発行済株式数',
        value: sharesOutstanding ?? 0,
        field: 'shares_outstanding',
      },
    ],
    rounding: ROUNDING_RULE.yen,
  });
}

/** 理論PER = 理論時価総額 ÷ 純利益（倍） */
export function calcTheoryPER(
  theoryMarketCap: number | null,
  netIncome: number
): CalcResult<number> {
  const value =
    theoryMarketCap == null || netIncome === 0
      ? null
      : roundToTwoDecimals(theoryMarketCap / netIncome);
  return createCalcResult(value, {
    formula: '理論PER = 理論時価総額 ÷ 純利益',
    inputs: [
      {
        label: '理論時価総額',
        value: theoryMarketCap ?? 0,
        field: 'theory_market_cap（算出値）',
      },
      { label: '純利益', value: netIncome, field: 'net_income' },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/** 5年後理論時価総額 = 理論時価総額 × (1 + g)^5 */
export function calcFutureTheoryMarketCap(
  theoryMarketCap: number | null,
  growthRate: number,
  years: number = 5
): CalcResult<number> {
  const value =
    theoryMarketCap == null
      ? null
      : roundYen(theoryMarketCap * Math.pow(1 + growthRate, years));
  return createCalcResult(value, {
    formula: `${years}年後理論時価総額 = 理論時価総額 × (1+g)^${years}`,
    inputs: [
      {
        label: '理論時価総額',
        value: theoryMarketCap ?? 0,
        field: 'theory_market_cap（算出値）',
      },
      { label: '成長率', value: growthRate, field: 'growth_rate' },
    ],
    rounding: ROUNDING_RULE.yen,
  });
}

/** 6年目当期純利益 = 純利益 × (1+g)^5 */
export function calcFutureNetIncome(
  netIncome: number,
  growthRate: number,
  years: number = 5
): CalcResult<number> {
  const value = roundYen(netIncome * Math.pow(1 + growthRate, years));
  return createCalcResult(value, {
    formula: `${years + 1}年目当期純利益 = 純利益 × (1+g)^${years}`,
    inputs: [
      { label: '純利益', value: netIncome, field: 'net_income' },
      { label: '成長率', value: growthRate, field: 'growth_rate' },
    ],
    rounding: ROUNDING_RULE.yen,
  });
}
