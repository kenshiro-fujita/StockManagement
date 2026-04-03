import type { IndicatorResults } from '@/lib/types/calc';

export type ComparisonDirection = 'higher' | 'lower' | 'none';

export type ComparisonIndicator = {
  field: string;
  label: string;
  direction: ComparisonDirection;
  format: 'stockPrice' | 'percent' | 'percentUnsigned' | 'currency' | 'multiple' | 'perShare';
};

export const COMPARISON_CATEGORIES: {
  title: string;
  indicators: ComparisonIndicator[];
}[] = [
  {
    title: '理論価値・安全性',
    indicators: [
      { field: 'theoryPrice', label: '現状理論株価', direction: 'none', format: 'stockPrice' },
      { field: 'growthTheoryPrice', label: '成長込理論株価', direction: 'none', format: 'stockPrice' },
      { field: 'safetyRateCurrent', label: '安全率（現状）', direction: 'higher', format: 'percent' },
      { field: 'safetyRateGrowth', label: '安全率（成長込）', direction: 'higher', format: 'percent' },
    ],
  },
  {
    title: '収益性',
    indicators: [
      { field: 'equityRatio', label: '自己資本比率', direction: 'higher', format: 'percentUnsigned' },
      { field: 'netProfitMargin', label: '純利益率', direction: 'higher', format: 'percentUnsigned' },
      { field: 'operatingMargin', label: '営業利益率', direction: 'higher', format: 'percentUnsigned' },
    ],
  },
  {
    title: '資本効率',
    indicators: [
      { field: 'roe', label: 'ROE', direction: 'higher', format: 'percentUnsigned' },
      { field: 'roa', label: 'ROA', direction: 'higher', format: 'percentUnsigned' },
      { field: 'roic', label: 'ROIC', direction: 'higher', format: 'percentUnsigned' },
      { field: 'movingAverageROIC', label: '移動平均ROIC', direction: 'higher', format: 'percentUnsigned' },
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
      { field: 'operatingCF', label: '営業CF', direction: 'none', format: 'currency' },
      { field: 'investingCF', label: '投資CF', direction: 'none', format: 'currency' },
      { field: 'fcf', label: 'FCF', direction: 'higher', format: 'currency' },
    ],
  },
];

function getFieldValue(results: IndicatorResults, field: string): number | null {
  if (field === 'movingAverageROIC') return results.movingAverageROIC.value;
  const period = results.period as Record<string, { value: number | null }>;
  return period[field]?.value ?? null;
}

/**
 * 複数銘柄のある指標の値から最良インデックスを特定する。
 * direction=none の場合はハイライトなし（-1を返す）。
 */
export function findBestIndex(
  values: (number | null)[],
  direction: ComparisonDirection,
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
  allResults: (IndicatorResults | null)[],
  field: string,
): (number | null)[] {
  return allResults.map((r) => (r ? getFieldValue(r, field) : null));
}
