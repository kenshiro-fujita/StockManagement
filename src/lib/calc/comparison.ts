/**
 * 銘柄比較ビューのロジック
 *
 * 複数銘柄を横並びにしたとき、各指標の「最良値」をハイライトするための判定ロジック。
 *
 * direction（どちらが良いか）:
 * - 'higher': 値が大きいほど良い（ROE, 安全率, EPS 等）
 * - 'lower': 値が小さいほど良い（PER, PBR）
 * - 'none': 比較不可（理論株価は銘柄固有のためハイライトしない）
 */
import type { IndicatorResults, PeriodIndicators } from '@/lib/types/calc';

/** 指標の「良い方向」を示す。higher=大きいほど良い, lower=小さいほど良い, none=比較しない */
export type ComparisonDirection = 'higher' | 'lower' | 'none';

/** 一括計算結果に実在する指標だけを比較定義へ登録できるようにする。 */
export type ComparisonField = keyof PeriodIndicators | 'movingAverageROIC';

/** 表示側が対応しているフォーマッタの識別子。 */
export type ComparisonFormat =
  | 'stockPrice'
  | 'percent'
  | 'percentUnsigned'
  | 'currency'
  | 'multiple'
  | 'perShare';

/** 比較テーブルに表示する1つの指標の定義 */
export type ComparisonIndicator = {
  /** IndicatorResults のフィールド名 */
  field: ComparisonField;
  /** 日本語表示名 */
  label: string;
  /** どちらの値が良いか */
  direction: ComparisonDirection;
  /** 表示フォーマット */
  format: ComparisonFormat;
};

/** 比較画面の表示カテゴリ。指標定義と計算結果の型をコンパイル時に同期する。 */
export const COMPARISON_CATEGORIES: {
  title: string;
  indicators: ComparisonIndicator[];
}[] = [
  {
    title: '理論価値・安全性',
    indicators: [
      {
        field: 'theoryPrice',
        label: '現状理論株価',
        direction: 'none',
        format: 'stockPrice',
      },
      {
        field: 'growthTheoryPrice',
        label: '成長込理論株価',
        direction: 'none',
        format: 'stockPrice',
      },
      {
        field: 'safetyRateCurrent',
        label: '安全率（現状）',
        direction: 'higher',
        format: 'percent',
      },
      {
        field: 'safetyRateGrowth',
        label: '安全率（成長込）',
        direction: 'higher',
        format: 'percent',
      },
    ],
  },
  {
    title: '収益性',
    indicators: [
      {
        field: 'equityRatio',
        label: '自己資本比率',
        direction: 'higher',
        format: 'percentUnsigned',
      },
      {
        field: 'netProfitMargin',
        label: '純利益率',
        direction: 'higher',
        format: 'percentUnsigned',
      },
      {
        field: 'operatingMargin',
        label: '営業利益率',
        direction: 'higher',
        format: 'percentUnsigned',
      },
    ],
  },
  {
    title: '資本効率',
    indicators: [
      {
        field: 'roe',
        label: 'ROE',
        direction: 'higher',
        format: 'percentUnsigned',
      },
      {
        field: 'roa',
        label: 'ROA',
        direction: 'higher',
        format: 'percentUnsigned',
      },
      {
        field: 'roic',
        label: 'ROIC',
        direction: 'higher',
        format: 'percentUnsigned',
      },
      {
        field: 'movingAverageROIC',
        label: '移動平均ROIC',
        direction: 'higher',
        format: 'percentUnsigned',
      },
    ],
  },
  {
    title: '株式指標',
    indicators: [
      { field: 'eps', label: 'EPS', direction: 'higher', format: 'perShare' },
      { field: 'per', label: 'PER', direction: 'lower', format: 'multiple' },
      { field: 'pbr', label: 'PBR', direction: 'lower', format: 'multiple' },
    ],
  },
  {
    title: 'キャッシュフロー',
    indicators: [
      {
        field: 'operatingCF',
        label: '営業CF',
        direction: 'none',
        format: 'currency',
      },
      {
        field: 'investingCF',
        label: '投資CF',
        direction: 'none',
        format: 'currency',
      },
      { field: 'fcf', label: 'FCF', direction: 'higher', format: 'currency' },
    ],
  },
];

/** IndicatorResults から指標フィールド名で値を取得する（movingAverageROIC は特別扱い） */
function getFieldValue(
  results: IndicatorResults,
  field: ComparisonField
): number | null {
  if (field === 'movingAverageROIC') return results.movingAverageROIC.value;
  return results.period[field].value;
}

/**
 * 複数銘柄のある指標の値から最良インデックスを特定する。
 * direction=none の場合はハイライトなし（-1を返す）。
 */
export function findBestIndex(
  values: readonly (number | null)[],
  direction: ComparisonDirection
): number {
  if (direction === 'none') return -1;

  let bestIdx = -1;
  let bestVal: number | null = null;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (bestVal == null) {
      bestIdx = i;
      bestVal = v;
    } else if (direction === 'higher' && v > bestVal) {
      bestIdx = i;
      bestVal = v;
    } else if (direction === 'lower' && v < bestVal) {
      bestIdx = i;
      bestVal = v;
    }
  }

  return bestIdx;
}

/** 比較対象の全銘柄から指標値の配列を取得する */
export function getComparisonValues(
  allResults: readonly (IndicatorResults | null)[],
  field: ComparisonField
): (number | null)[] {
  return allResults.map((r) => (r ? getFieldValue(r, field) : null));
}
