/** 端数処理: パーセンテージ → 小数点以下第2位を四捨五入 */
export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
