/**
 * 安全性指標の計算関数群
 *
 * 理論株価と現在の市場価格を比較し、投資判断の安全度を算出する。
 *
 * - 安全域: 理論株価 - 現在株価（プラスなら割安、マイナスなら割高）
 * - 安全率: 安全域 ÷ 理論株価 × 100（%表示。+15% なら「理論価値より15%安い」）
 * - 理想購入株価: 理論株価の半値（discountFactor=0.5）。バリュー投資の基本原則。
 * - 割安/適正/割高の判定: 安全率 > 0 → 割安、-10〜0 → 適正、< -10 → 割高
 */
import type { CalcResult } from '@/lib/types/calc';
import { roundPercent, truncateYen } from './utils';
import { createCalcResult, ROUNDING_RULE } from './result';

/** 安全域 = 理論株価 - 現在株価（円） */
export function calcSafetyMargin(
  theoryPrice: number | null,
  currentStockPrice: number | null,
  label: string = '現状'
): CalcResult<number> {
  const value =
    theoryPrice == null || currentStockPrice == null
      ? null
      : theoryPrice - currentStockPrice;
  return createCalcResult(value, {
    formula: `安全域（${label}）= ${label}理論株価 - 現在株価`,
    inputs: [
      {
        label: `${label}理論株価`,
        value: theoryPrice ?? 0,
        field: 'theory_price（算出値）',
      },
      {
        label: '現在株価',
        value: currentStockPrice ?? 0,
        field: 'current_stock_price',
      },
    ],
    rounding: ROUNDING_RULE.integerSubtraction,
  });
}

/**
 * 安全率 = (理論株価 - 現在株価) ÷ 理論株価 × 100（%）
 *
 * 理論株価が 0 以下の場合は算出不可（null）とする。
 * 負の理論株価で割ると符号が反転し、債務超過的な銘柄（理論価値が負）が
 * 「+150% 割安」のように最上位の割安と誤判定されてしまうため。
 */
export function calcSafetyRate(
  theoryPrice: number | null,
  currentStockPrice: number | null,
  label: string = '現状'
): CalcResult<number> {
  const value =
    theoryPrice == null || theoryPrice <= 0 || currentStockPrice == null
      ? null
      : roundPercent(((theoryPrice - currentStockPrice) / theoryPrice) * 100);
  return createCalcResult(value, {
    formula: `安全率（${label}）= (${label}理論株価 - 現在株価) ÷ ${label}理論株価 × 100`,
    inputs: [
      {
        label: `${label}理論株価`,
        value: theoryPrice ?? 0,
        field: 'theory_price（算出値）',
      },
      {
        label: '現在株価',
        value: currentStockPrice ?? 0,
        field: 'current_stock_price',
      },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/**
 * 安全率から割安/適正/割高を判定する
 * - cheap（割安）: 安全率 > 0%（理論株価より市場価格が安い）
 * - fair（適正）: -10% 〜 0%（概ね理論株価通り）
 * - expensive（割高）: < -10%（理論株価より市場価格が高い）
 *
 * この関数は Server Component（StockTable）からも呼ばれるため、
 * 'use client' のコンポーネントではなく lib/calc/ に配置している。
 */
export type ValuationLevel = 'cheap' | 'fair' | 'expensive';

export function getValuationLevel(
  safetyRateValue: number | null
): ValuationLevel | null {
  if (safetyRateValue == null) return null;
  if (safetyRateValue > 0) return 'cheap';
  if (safetyRateValue >= -10) return 'fair';
  return 'expensive';
}

/**
 * 割安/適正/割高の日本語ラベル。
 * 色だけで割安・割高を伝えると WCAG 1.4.1 違反になるため、
 * テキスト併記やスクリーンリーダー向けラベルにこのマップを使う
 */
export const VALUATION_LEVEL_LABELS: Record<ValuationLevel, string> = {
  cheap: '割安',
  fair: '適正',
  expensive: '割高',
};

/**
 * 理想購入株価 = 理論株価 × 割引係数（デフォルト0.5＝半値）
 *
 * 理論株価が 0 以下の場合は「買うべき価格が存在しない」ため算出不可（null）。
 * （負値に floor を適用すると絶対値が増えて意味不明な値になる問題も同時に防ぐ）
 */
export function calcIdealBuyPrice(
  theoryPrice: number | null,
  label: string = '現状',
  discountFactor: number = 0.5
): CalcResult<number> {
  const value =
    theoryPrice == null || theoryPrice <= 0
      ? null
      : truncateYen(theoryPrice * discountFactor);
  return createCalcResult(value, {
    formula: `理想購入株価（対${label}）= ${label}理論株価 × ${discountFactor}`,
    inputs: [
      {
        label: `${label}理論株価`,
        value: theoryPrice ?? 0,
        field: 'theory_price（算出値）',
      },
      { label: '割引係数', value: discountFactor, field: 'discount_factor' },
    ],
    rounding: ROUNDING_RULE.truncateYen,
  });
}
