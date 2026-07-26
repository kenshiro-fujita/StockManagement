/**
 * 財務比率の計算関数群
 *
 * 収益性（自己資本比率、純利益率、営業利益率）と
 * 資本効率（ROE、ROA、ROIC）を算出する。
 *
 * 全関数が CalcResult<number> を返し、計算メタデータ（数式・入力値・端数処理）を含む。
 * 分母がゼロの場合は null を返す（ゼロ除算防止）。
 */
import type { CalcResult } from '@/lib/types/calc';
import { roundPercent } from './utils';
import { createCalcResult, ROUNDING_RULE } from './result';

/**
 * 自己資本比率 = 自己資本 ÷ 総資産 × 100（%）
 * equityField/equityLabel は resolveEquity が解決した「実際に使ったカラム」の表示用情報
 */
export function calcEquityRatio(
  equity: number,
  totalAssets: number,
  equityField: string = 'equity',
  equityLabel: string = '自己資本'
): CalcResult<number> {
  const value =
    totalAssets === 0 ? null : roundPercent((equity / totalAssets) * 100);
  return createCalcResult(value, {
    formula: '自己資本比率 = 自己資本 ÷ 総資産 × 100',
    inputs: [
      { label: equityLabel, value: equity, field: equityField },
      { label: '総資産', value: totalAssets, field: 'total_assets' },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/** 純利益率 = 純利益 ÷ 売上高 × 100（%） */
export function calcNetProfitMargin(
  netIncome: number,
  revenue: number
): CalcResult<number> {
  const value =
    revenue === 0 ? null : roundPercent((netIncome / revenue) * 100);
  return createCalcResult(value, {
    formula: '純利益率 = 純利益 ÷ 売上高 × 100',
    inputs: [
      { label: '純利益', value: netIncome, field: 'net_income' },
      { label: '売上高', value: revenue, field: 'revenue' },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/** 売上営業利益率 = 営業利益 ÷ 売上高 × 100（%） */
export function calcOperatingMargin(
  operatingIncome: number,
  revenue: number
): CalcResult<number> {
  const value =
    revenue === 0 ? null : roundPercent((operatingIncome / revenue) * 100);
  return createCalcResult(value, {
    formula: '売上営業利益率 = 営業利益 ÷ 売上高 × 100',
    inputs: [
      { label: '営業利益', value: operatingIncome, field: 'operating_income' },
      { label: '売上高', value: revenue, field: 'revenue' },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/** ROE = 純利益 ÷ 自己資本 × 100（%） */
export function calcROE(
  netIncome: number,
  equity: number,
  equityField: string = 'equity',
  equityLabel: string = '自己資本'
): CalcResult<number> {
  const value = equity === 0 ? null : roundPercent((netIncome / equity) * 100);
  return createCalcResult(value, {
    formula: 'ROE = 純利益 ÷ 自己資本 × 100',
    inputs: [
      { label: '純利益', value: netIncome, field: 'net_income' },
      { label: equityLabel, value: equity, field: equityField },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/** ROA = 純利益 ÷ 総資産 × 100（%） */
export function calcROA(
  netIncome: number,
  totalAssets: number
): CalcResult<number> {
  const value =
    totalAssets === 0 ? null : roundPercent((netIncome / totalAssets) * 100);
  return createCalcResult(value, {
    formula: 'ROA = 純利益 ÷ 総資産 × 100',
    inputs: [
      { label: '純利益', value: netIncome, field: 'net_income' },
      { label: '総資産', value: totalAssets, field: 'total_assets' },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/** ROIC = 営業利益 × (1-実効税率) ÷ (自己資本+有利子負債) × 100（%） */
export function calcROIC(
  operatingIncome: number,
  taxRate: number,
  equity: number,
  interestBearingDebt: number,
  equityField: string = 'equity',
  equityLabel: string = '自己資本'
): CalcResult<number> {
  const investedCapital = equity + interestBearingDebt;
  const value =
    investedCapital === 0
      ? null
      : roundPercent(
          ((operatingIncome * (1 - taxRate)) / investedCapital) * 100
        );
  return createCalcResult(value, {
    formula: 'ROIC = 営業利益 × (1-実効税率) ÷ (自己資本+有利子負債) × 100',
    inputs: [
      { label: '営業利益', value: operatingIncome, field: 'operating_income' },
      { label: '実効税率', value: taxRate, field: 'tax_rate' },
      { label: equityLabel, value: equity, field: equityField },
      {
        label: '有利子負債',
        value: interestBearingDebt,
        field: 'interest_bearing_debt',
      },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}
