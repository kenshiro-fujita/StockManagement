/**
 * 金額・パーセンテージ・倍率の表示規則を一箇所に集約する。
 *
 * 計算値そのものは変更せず、画面間で単位・符号・null 表示が揺れないようにする。
 */

/** null 値のデフォルト表示 */
export const NULL_DISPLAY = '—';

/** 日本語の金額表示で使用する単位換算。 */
const YEN_PER_MILLION = 1_000_000;
const YEN_PER_OKU = 100_000_000;

/** 億円表示を作る箇所を共通化し、境界フォールバックと通常経路を一致させる。 */
function formatOku(absValue: number, sign: string): string {
  return `${sign}${(absValue / YEN_PER_OKU).toFixed(1)}億円`;
}

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
  if (abs >= YEN_PER_OKU) {
    return formatOku(abs, sign);
  }

  // 百万円（丸め後に100.0以上になる場合は億円表示にフォールバック）
  if (abs >= YEN_PER_MILLION) {
    const million = abs / YEN_PER_MILLION;
    const rounded = parseFloat(million.toFixed(1));
    if (rounded >= 100) {
      return formatOku(abs, sign);
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

/** 表示前に浮動小数点誤差を除去して小数2桁に丸める。 */
function roundForDisplay(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 小数指標の null・正符号・接尾辞を同じ規則で整形する。 */
function formatDecimal(
  value: number | null,
  suffix: string,
  showPositiveSign = false
): string {
  if (value == null) return NULL_DISPLAY;
  const rounded = roundForDisplay(value);
  const sign = showPositiveSign && rounded > 0 ? '+' : '';
  return `${sign}${rounded}${suffix}`;
}

/**
 * パーセンテージ表示フォーマッタ（符号付き、小数2桁まで）
 */
export function formatPercent(value: number | null): string {
  return formatDecimal(value, '%', true);
}

/**
 * パーセンテージ表示（符号なし — 比率用、小数2桁まで）
 */
export function formatPercentUnsigned(value: number | null): string {
  return formatDecimal(value, '%');
}

/**
 * 倍率表示フォーマッタ（PER/PBR 用、小数2桁まで）
 */
export function formatMultiple(value: number | null): string {
  return formatDecimal(value, '倍');
}

/**
 * EPS 等の1株あたり金額フォーマット（小数2桁まで）
 */
export function formatPerShare(value: number | null): string {
  return formatDecimal(value, '円');
}
