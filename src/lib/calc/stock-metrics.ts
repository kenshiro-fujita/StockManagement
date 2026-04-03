/**
 * 株式指標の計算関数群
 *
 * EPS（1株当たり利益）、PER（株価収益率）、PBR（株価純資産倍率）、FCF（フリーキャッシュフロー）
 * を算出する。これらは「現在の市場価格との比較」に使う指標であり、
 * current_stock_price が null の場合は PER/PBR が算出不可（null）になる。
 */
import type { CalcResult } from '@/lib/types/calc';
import { CALC_VERSION } from '@/lib/types/calc';
import { roundPercent as round2 } from './utils';

/** EPS = 純利益 ÷ 発行済株式数（円） */
export function calcEPS(
  netIncome: number,
  sharesOutstanding: number | null,
): CalcResult<number> {
  const value =
    sharesOutstanding == null || sharesOutstanding === 0
      ? null
      : round2(netIncome / sharesOutstanding);
  return {
    value,
    metadata: {
      formula: 'EPS = 純利益 ÷ 発行済株式数',
      inputs: [
        { label: '純利益', value: netIncome, field: 'net_income' },
        { label: '発行済株式数', value: sharesOutstanding ?? 0, field: 'shares_outstanding' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** PER = 現在株価 ÷ EPS（倍） */
export function calcPER(
  currentStockPrice: number | null,
  eps: number | null,
): CalcResult<number> {
  const value =
    currentStockPrice == null || eps == null || eps === 0
      ? null
      : round2(currentStockPrice / eps);
  return {
    value,
    metadata: {
      formula: 'PER = 現在株価 ÷ EPS',
      inputs: [
        { label: '現在株価', value: currentStockPrice ?? 0, field: 'current_stock_price' },
        { label: 'EPS', value: eps ?? 0, field: 'eps（算出値）' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** PBR = 現在株価 × 発行済株式数 ÷ 自己資本（倍） */
export function calcPBR(
  currentStockPrice: number | null,
  sharesOutstanding: number | null,
  equity: number,
): CalcResult<number> {
  const value =
    currentStockPrice == null || sharesOutstanding == null || equity === 0
      ? null
      : round2((currentStockPrice * sharesOutstanding) / equity);
  return {
    value,
    metadata: {
      formula: 'PBR = 現在株価 × 発行済株式数 ÷ 自己資本',
      inputs: [
        { label: '現在株価', value: currentStockPrice ?? 0, field: 'current_stock_price' },
        { label: '発行済株式数', value: sharesOutstanding ?? 0, field: 'shares_outstanding' },
        { label: '自己資本', value: equity, field: 'equity' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** FCF = 営業CF + 投資CF（円） */
export function calcFCF(
  operatingCF: number | null,
  investingCF: number | null,
): CalcResult<number> {
  const value =
    operatingCF == null || investingCF == null
      ? null
      : Math.round(operatingCF + investingCF);
  return {
    value,
    metadata: {
      formula: 'FCF = 営業CF + 投資CF',
      inputs: [
        { label: '営業CF', value: operatingCF ?? 0, field: 'operating_cf' },
        { label: '投資CF', value: investingCF ?? 0, field: 'investing_cf' },
      ],
      rounding: '円未満四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}
