/**
 * 共通フォーマッタ — 金額、パーセンテージ、倍率、null表示
 */

/** null 値のデフォルト表示 */
export const NULL_DISPLAY = '—';

/**
 * 金額を人間が読みやすい単位に自動変換する
 * - 1億円以上 → 「○○億円」（小数点以下1位まで）
 * - 1百万円以上 → 「○○百万円」（小数点以下1位まで）
 * - それ未満 → 「○○円」（整数、カンマ区切り）
 */
export function formatCurrency(value: number | null): string {
  if (value == null) return NULL_DISPLAY;

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // 億円（toFixed(1) の丸めで境界を超える場合も考慮）
  if (abs >= 100_000_000) {
    const oku = abs / 100_000_000;
    return `${sign}${oku.toFixed(1)}億円`;
  }

  // 百万円（丸め後に100.0以上になる場合は億円表示にフォールバック）
  if (abs >= 1_000_000) {
    const million = abs / 1_000_000;
    const rounded = parseFloat(million.toFixed(1));
    if (rounded >= 100) {
      return `${sign}${(abs / 100_000_000).toFixed(1)}億円`;
    }
    return `${sign}${million.toFixed(1)}百万円`;
  }

  // 円
  return `${sign}${Math.round(abs).toLocaleString('ja-JP')}円`;
}

/**
 * 株価（円単位）のフォーマット — カンマ区切り + 円
 */
export function formatStockPrice(value: number | null): string {
  if (value == null) return NULL_DISPLAY;
  return `${value.toLocaleString('ja-JP')}円`;
}

/** 浮動小数点誤差を除去して小数2桁に丸める */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * パーセンテージ表示フォーマッタ（符号付き、小数2桁まで）
 */
export function formatPercent(value: number | null): string {
  if (value == null) return NULL_DISPLAY;
  const v = round2(value);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}%`;
}

/**
 * パーセンテージ表示（符号なし — 比率用、小数2桁まで）
 */
export function formatPercentUnsigned(value: number | null): string {
  if (value == null) return NULL_DISPLAY;
  return `${round2(value)}%`;
}

/**
 * 倍率表示フォーマッタ（PER/PBR 用、小数2桁まで）
 */
export function formatMultiple(value: number | null): string {
  if (value == null) return NULL_DISPLAY;
  return `${round2(value)}倍`;
}

/**
 * EPS 等の1株あたり金額フォーマット（小数2桁まで）
 */
export function formatPerShare(value: number | null): string {
  if (value == null) return NULL_DISPLAY;
  return `${round2(value)}円`;
}
