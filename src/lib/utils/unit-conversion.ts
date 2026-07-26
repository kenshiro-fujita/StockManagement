/**
 * 財務入力の表示単位と、計算エンジンが使用する円単位を相互変換する。
 *
 * 倍率を一箇所に集約し、入力フォームごとに千円・百万円の換算規則が
 * 分岐しないようにする。円へ変換する際の既存の整数丸め仕様は維持する。
 */
export type InputUnit = 'yen' | 'thousand' | 'million' | 'billion';

/** 入力単位1あたりの円換算倍率。 */
const UNIT_MULTIPLIERS = {
  yen: 1,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
} as const satisfies Record<InputUnit, number>;

/** 入力フォームに表示する単位名。 */
export const INPUT_UNIT_LABELS: Record<InputUnit, string> = {
  yen: '円',
  thousand: '千円',
  million: '百万円',
  billion: '10億円',
};

/** 指定単位の入力値を計算用の円整数へ変換する。 */
export function toYen(value: number, unit: InputUnit): number {
  return Math.round(value * UNIT_MULTIPLIERS[unit]);
}

/** 保存済みの円値を、入力フォームで選択した単位へ戻す。 */
export function fromYen(valueInYen: number, unit: InputUnit): number {
  return valueInYen / UNIT_MULTIPLIERS[unit];
}
