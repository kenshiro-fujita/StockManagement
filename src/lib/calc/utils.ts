/**
 * 端数処理: パーセンテージ → 小数点以下第2位を四捨五入
 *
 * 例: 12.345 → 12.35、-3.141 → -3.14
 *
 * 全ての %指標（ROE, 安全率等）と、EPS・PER・PBR 等の小数指標で共通使用。
 * 端数処理ルールを一箇所に集約することで、ゴールデンテストとの一致を保証する。
 */
export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
