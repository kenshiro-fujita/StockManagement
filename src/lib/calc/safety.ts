import type { CalcResult } from '@/lib/types/calc';
import { CALC_VERSION } from '@/lib/types/calc';
import { roundPercent } from './utils';

/** 安全域 = 理論株価 - 現在株価（円） */
export function calcSafetyMargin(
  theoryPrice: number | null,
  currentStockPrice: number | null,
  label: string = '現状',
): CalcResult<number> {
  const value =
    theoryPrice == null || currentStockPrice == null
      ? null
      : theoryPrice - currentStockPrice;
  return {
    value,
    metadata: {
      formula: `安全域（${label}）= ${label}理論株価 - 現在株価`,
      inputs: [
        { label: `${label}理論株価`, value: theoryPrice ?? 0, field: 'theory_price（算出値）' },
        { label: '現在株価', value: currentStockPrice ?? 0, field: 'current_stock_price' },
      ],
      rounding: 'なし（整数同士の減算）',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 安全率 = (理論株価 - 現在株価) ÷ 理論株価 × 100（%） */
export function calcSafetyRate(
  theoryPrice: number | null,
  currentStockPrice: number | null,
  label: string = '現状',
): CalcResult<number> {
  const value =
    theoryPrice == null || theoryPrice === 0 || currentStockPrice == null
      ? null
      : roundPercent(((theoryPrice - currentStockPrice) / theoryPrice) * 100);
  return {
    value,
    metadata: {
      formula: `安全率（${label}）= (${label}理論株価 - 現在株価) ÷ ${label}理論株価 × 100`,
      inputs: [
        { label: `${label}理論株価`, value: theoryPrice ?? 0, field: 'theory_price（算出値）' },
        { label: '現在株価', value: currentStockPrice ?? 0, field: 'current_stock_price' },
      ],
      rounding: '小数点以下第2位を四捨五入',
      calcVersion: CALC_VERSION,
    },
  };
}

/** 理想購入株価 = 理論株価 × 割引係数（デフォルト0.5＝半値） */
export function calcIdealBuyPrice(
  theoryPrice: number | null,
  label: string = '現状',
  discountFactor: number = 0.5,
): CalcResult<number> {
  const value =
    theoryPrice == null ? null : Math.floor(theoryPrice * discountFactor);
  return {
    value,
    metadata: {
      formula: `理想購入株価（対${label}）= ${label}理論株価 × ${discountFactor}`,
      inputs: [
        { label: `${label}理論株価`, value: theoryPrice ?? 0, field: 'theory_price（算出値）' },
        { label: '割引係数', value: discountFactor, field: 'discount_factor' },
      ],
      rounding: '円未満切捨て',
      calcVersion: CALC_VERSION,
    },
  };
}
