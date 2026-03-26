import type { CalcResult } from '@/lib/types/calc';
import { CALC_VERSION } from '@/lib/types/calc';
import { roundPercent } from './utils';

/** 自己資本比率 = 自己資本 ÷ 総資産 × 100（%） */
export function calcEquityRatio(
  equity: number,
  totalAssets: number,
): CalcResult<number> {
  const value = totalAssets === 0 ? null : roundPercent((equity / totalAssets) * 100);
  return {
    value,
    metadata: {
      formula: '自己資本比率 = 自己資本 ÷ 総資産 × 100',
      inputs: [
        { label: '自己資本', value: equity, field: 'equity' },
        { label: '総資産', value: totalAssets, field: 'total_assets' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 純利益率 = 純利益 ÷ 売上高 × 100（%） */
export function calcNetProfitMargin(
  netIncome: number,
  revenue: number,
): CalcResult<number> {
  const value = revenue === 0 ? null : roundPercent((netIncome / revenue) * 100);
  return {
    value,
    metadata: {
      formula: '純利益率 = 純利益 ÷ 売上高 × 100',
      inputs: [
        { label: '純利益', value: netIncome, field: 'net_income' },
        { label: '売上高', value: revenue, field: 'revenue' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 売上営業利益率 = 営業利益 ÷ 売上高 × 100（%） */
export function calcOperatingMargin(
  operatingIncome: number,
  revenue: number,
): CalcResult<number> {
  const value = revenue === 0 ? null : roundPercent((operatingIncome / revenue) * 100);
  return {
    value,
    metadata: {
      formula: '売上営業利益率 = 営業利益 ÷ 売上高 × 100',
      inputs: [
        { label: '営業利益', value: operatingIncome, field: 'operating_income' },
        { label: '売上高', value: revenue, field: 'revenue' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** ROE = 純利益 ÷ 自己資本 × 100（%） */
export function calcROE(
  netIncome: number,
  equity: number,
): CalcResult<number> {
  const value = equity === 0 ? null : roundPercent((netIncome / equity) * 100);
  return {
    value,
    metadata: {
      formula: 'ROE = 純利益 ÷ 自己資本 × 100',
      inputs: [
        { label: '純利益', value: netIncome, field: 'net_income' },
        { label: '自己資本', value: equity, field: 'equity' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** ROA = 純利益 ÷ 総資産 × 100（%） */
export function calcROA(
  netIncome: number,
  totalAssets: number,
): CalcResult<number> {
  const value = totalAssets === 0 ? null : roundPercent((netIncome / totalAssets) * 100);
  return {
    value,
    metadata: {
      formula: 'ROA = 純利益 ÷ 総資産 × 100',
      inputs: [
        { label: '純利益', value: netIncome, field: 'net_income' },
        { label: '総資産', value: totalAssets, field: 'total_assets' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** ROIC = 営業利益 × (1-実効税率) ÷ (自己資本+有利子負債) × 100（%） */
export function calcROIC(
  operatingIncome: number,
  taxRate: number,
  equity: number,
  interestBearingDebt: number,
): CalcResult<number> {
  const investedCapital = equity + interestBearingDebt;
  const value =
    investedCapital === 0
      ? null
      : roundPercent((operatingIncome * (1 - taxRate) / investedCapital) * 100);
  return {
    value,
    metadata: {
      formula: 'ROIC = 営業利益 × (1-実効税率) ÷ (自己資本+有利子負債) × 100',
      inputs: [
        { label: '営業利益', value: operatingIncome, field: 'operating_income' },
        { label: '実効税率', value: taxRate, field: 'tax_rate' },
        { label: '自己資本', value: equity, field: 'equity' },
        { label: '有利子負債', value: interestBearingDebt, field: 'interest_bearing_debt' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}
