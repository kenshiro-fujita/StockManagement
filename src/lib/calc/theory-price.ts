import type { CalcResult } from '@/lib/types/calc';
import { CALC_VERSION } from '@/lib/types/calc';

/**
 * 事業価値 = 営業利益 × (1-実効税率) ÷ (r-g)
 * 上限倍率適用: min(基本式, 営業利益 × cap_multiplier × (1-実効税率))
 */
export function calcBusinessValue(
  operatingIncome: number,
  taxRate: number,
  discountRate: number,
  growthRate: number,
  capMultiplier: number,
): CalcResult<number> {
  const afterTaxIncome = operatingIncome * (1 - taxRate);
  const rMinusG = discountRate - growthRate;

  if (rMinusG <= 0) {
    return {
      value: null,
      metadata: {
        formula: '事業価値 = 営業利益 × (1-実効税率) ÷ (r-g)（r ≤ g のため算出不可）',
        inputs: [
          { label: '営業利益', value: operatingIncome, field: 'operating_income' },
          { label: '実効税率', value: taxRate, field: 'tax_rate' },
          { label: '割引率', value: discountRate, field: 'discount_rate' },
          { label: '成長率', value: growthRate, field: 'growth_rate' },
        ],
        rounding: '円未満四捨五入',
        calcVersion: CALC_VERSION,
      },
    };
  }

  const dcfValue = afterTaxIncome / rMinusG;
  const capValue = operatingIncome * capMultiplier * (1 - taxRate);
  const value = Math.round(Math.min(dcfValue, capValue));
  const capped = capValue < dcfValue;

  return {
    value,
    metadata: {
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
      rounding: '円未満四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 現状資産価値 = 自己資本（株主資本） */
export function calcAssetValue(equity: number): CalcResult<number> {
  return {
    value: equity,
    metadata: {
      formula: '資産価値 = 自己資本（株主資本）',
      inputs: [{ label: '自己資本', value: equity, field: 'equity' }],
      rounding: 'なし（入力値そのまま）',
      calcVersion: CALC_VERSION,
    },
  };
}

/**
 * 現状理論株価 = (事業価値 + 資産価値 - 有利子負債) ÷ 発行済株式数
 * 円未満切捨て（Math.floor）
 */
export function calcTheoryPrice(
  businessValue: number,
  assetValue: number,
  interestBearingDebt: number,
  sharesOutstanding: number | null,
): CalcResult<number> {
  const value =
    sharesOutstanding == null || sharesOutstanding === 0
      ? null
      : Math.floor(
          (businessValue + assetValue - interestBearingDebt) / sharesOutstanding,
        );
  return {
    value,
    metadata: {
      formula: '理論株価 = (事業価値 + 資産価値 - 有利子負債) ÷ 発行済株式数',
      inputs: [
        { label: '事業価値', value: businessValue, field: 'business_value（算出値）' },
        { label: '資産価値', value: assetValue, field: 'asset_value（算出値）' },
        { label: '有利子負債', value: interestBearingDebt, field: 'interest_bearing_debt' },
        { label: '発行済株式数', value: sharesOutstanding ?? 0, field: 'shares_outstanding' },
      ],
      rounding: '円未満切捨て',
      calcVersion: CALC_VERSION,
    },
  };
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
  sharesOutstanding: number | null,
): CalcResult<number> {
  const rMinusG = discountRate - growthRate;
  if (
    rMinusG <= 0 ||
    sharesOutstanding == null ||
    sharesOutstanding === 0
  ) {
    return {
      value: null,
      metadata: {
        formula: '成長込理論株価 = (事業価値DCF + 資産価値 - 有利子負債) ÷ 発行済株式数',
        inputs: [
          { label: '営業利益', value: operatingIncome, field: 'operating_income' },
          { label: '割引率', value: discountRate, field: 'discount_rate' },
          { label: '成長率', value: growthRate, field: 'growth_rate' },
        ],
        rounding: '円未満切捨て',
        calcVersion: CALC_VERSION,
      },
    };
  }

  const businessValueDCF = operatingIncome * (1 - taxRate) / rMinusG;
  const value = Math.floor(
    (businessValueDCF + equity - interestBearingDebt) / sharesOutstanding,
  );
  return {
    value,
    metadata: {
      formula: '成長込理論株価 = (営業利益×(1-実効税率)÷(r-g) + 資産価値 - 有利子負債) ÷ 発行済株式数',
      inputs: [
        { label: '営業利益', value: operatingIncome, field: 'operating_income' },
        { label: '実効税率', value: taxRate, field: 'tax_rate' },
        { label: '割引率', value: discountRate, field: 'discount_rate' },
        { label: '成長率', value: growthRate, field: 'growth_rate' },
        { label: '自己資本', value: equity, field: 'equity' },
        { label: '有利子負債', value: interestBearingDebt, field: 'interest_bearing_debt' },
        { label: '発行済株式数', value: sharesOutstanding, field: 'shares_outstanding' },
      ],
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
      : Math.round(theoryPrice * sharesOutstanding);
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
      : Math.round((theoryMarketCap / netIncome) * 100) / 100;
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
      : Math.round(theoryMarketCap * Math.pow(1 + growthRate, years));
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
  const value = Math.round(netIncome * Math.pow(1 + growthRate, years));
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
