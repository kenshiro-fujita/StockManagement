/**
 * 成長性指標の計算関数群
 *
 * - 前年比成長率: (当期 - 前期) ÷ |前期| × 100
 *   前期がゼロの場合は null（ゼロ除算防止）。
 *   前期の絶対値で割ることで、前期がマイナスでも正しい成長率が出る。
 *
 * - 移動平均ROIC: 全期間のROICを平均化し、一時的な変動を平滑化する。
 *   複数年の資本効率トレンドを見るための指標。
 */
import type { CalcResult } from '@/lib/types/calc';
import { roundPercent } from './utils';
import { createCalcResult, ROUNDING_RULE } from './result';

/** 前年比成長率 = (当期 - 前期) ÷ |前期| × 100（%） */
export function calcYoYGrowthRate(
  current: number,
  previous: number,
  label: string,
  field: string
): CalcResult<number> {
  const value =
    previous === 0
      ? null
      : roundPercent(((current - previous) / Math.abs(previous)) * 100);
  return createCalcResult(value, {
    formula: `${label}前年比成長率 = (当期 - 前期) ÷ |前期| × 100`,
    inputs: [
      { label: `当期${label}`, value: current, field },
      { label: `前期${label}`, value: previous, field },
    ],
    rounding: ROUNDING_RULE.twoDecimals,
  });
}

/** 移動平均ROIC = ROIC の n 期分平均（%） */
export function calcMovingAverageROIC(
  roicValues: readonly (number | null)[]
): CalcResult<number> {
  const validValues = roicValues.filter((v): v is number => v != null);
  const value =
    validValues.length === 0
      ? null
      : roundPercent(
          validValues.reduce((sum, v) => sum + v, 0) / validValues.length
        );
  return createCalcResult(value, {
    formula: `移動平均ROIC = ROIC ${validValues.length}期分平均`,
    inputs: validValues.map((v, i) => ({
      label: `ROIC（${i + 1}期目）`,
      value: v,
      field: 'roic（算出値）',
    })),
    rounding: ROUNDING_RULE.twoDecimals,
  });
}
