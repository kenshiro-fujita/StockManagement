'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { IndicatorResults, CalcResult } from '@/lib/types/calc';
import {
  formatCurrency,
  formatStockPrice,
  formatPercent,
  formatPercentUnsigned,
  formatMultiple,
  formatPerShare,
  NULL_DISPLAY,
} from '@/lib/format';

// ---------- Empty State ----------

function TheoryPriceEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Calculator className="text-muted-foreground mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-semibold">
        理論株価を算出できません
      </h3>
      <p className="text-muted-foreground mb-4">
        財務データを入力すると理論株価が算出されます
      </p>
    </div>
  );
}

// ---------- Change Detection ----------

function getIndicatorValue(
  results: IndicatorResults,
  field: string,
): CalcResult<number> | undefined {
  if (field === 'movingAverageROIC') return results.movingAverageROIC;
  return (results.period as Record<string, CalcResult<number>>)[field];
}

/** Detect which indicator fields changed between previous and current results */
export function detectChangedFields(
  prev: IndicatorResults | null,
  current: IndicatorResults | null,
): Set<string> {
  if (!prev || !current) return new Set();
  const changed = new Set<string>();

  // Check all period indicators
  for (const key of Object.keys(current.period)) {
    const prevCalc = (prev.period as Record<string, CalcResult<number>>)[key];
    const currCalc = (current.period as Record<string, CalcResult<number>>)[key];
    if (prevCalc && currCalc && prevCalc.value !== currCalc.value) {
      changed.add(key);
    }
  }

  // Check movingAverageROIC
  if (prev.movingAverageROIC.value !== current.movingAverageROIC.value) {
    changed.add('movingAverageROIC');
  }

  return changed;
}

// ---------- Badge ----------

type ValuationLevel = 'cheap' | 'fair' | 'expensive';

export function getValuationLevel(safetyRateValue: number | null): ValuationLevel | null {
  if (safetyRateValue == null) return null;
  if (safetyRateValue > 0) return 'cheap';
  if (safetyRateValue >= -10) return 'fair';
  return 'expensive';
}

const BADGE_CONFIG: Record<ValuationLevel, { label: string; className: string; Icon: typeof TrendingUp }> = {
  cheap: {
    label: '割安',
    className: 'bg-green-100 text-green-800 border-green-300',
    Icon: TrendingUp,
  },
  fair: {
    label: '適正',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Icon: Minus,
  },
  expensive: {
    label: '割高',
    className: 'bg-red-100 text-red-800 border-red-300',
    Icon: TrendingDown,
  },
};

function ValuationBadge({ level }: { level: ValuationLevel }) {
  const { label, className, Icon } = BADGE_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${className}`}
      role="status"
      aria-label={`現在の評価: ${label}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

// ---------- Highlight Hook ----------

/**
 * Manages highlight animation state with proper cleanup for CSS animation replay.
 *
 * Returns a Set of fields currently highlighted.
 * Uses useState so that clearing the set triggers a re-render,
 * which removes the animate-highlight class and allows it to replay on next change.
 */
function useHighlight(changedFields: Set<string>, durationMs = 300): Set<string> {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (changedFields.size === 0) return;

    setHighlighted(new Set(changedFields));

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setHighlighted(new Set());
    }, durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [changedFields, durationMs]);

  return highlighted;
}

// ---------- Comparison Summary ----------

function ComparisonSummary({
  currentStockPrice,
  theoryPrice,
  growthTheoryPrice,
  safetyRateCurrent,
  changedFields,
}: {
  currentStockPrice: number | null;
  theoryPrice: CalcResult<number>;
  growthTheoryPrice: CalcResult<number>;
  safetyRateCurrent: CalcResult<number>;
  changedFields: Set<string>;
}) {
  const level = getValuationLevel(safetyRateCurrent.value);
  const hasPrice = currentStockPrice != null;

  return (
    <section aria-labelledby="comparison-heading">
      <h3 id="comparison-heading" className="mb-4 text-lg font-semibold">
        理論株価と市場価格の比較
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="現在株価"
          value={hasPrice ? formatStockPrice(currentStockPrice) : NULL_DISPLAY}
          muted={!hasPrice}
        />
        <SummaryCard
          label="現状理論株価"
          value={formatStockPrice(theoryPrice.value)}
          dataIndicator="theoryPrice"
          highlighted={changedFields.has('theoryPrice')}
        />
        <SummaryCard
          label="成長込理論株価"
          value={formatStockPrice(growthTheoryPrice.value)}
          dataIndicator="growthTheoryPrice"
          highlighted={changedFields.has('growthTheoryPrice')}
        />
        <SummaryCard
          label="安全率（現状）"
          value={formatPercent(safetyRateCurrent.value)}
          dataIndicator="safetyRateCurrent"
          badge={level ? <ValuationBadge level={level} /> : undefined}
          highlighted={changedFields.has('safetyRateCurrent')}
        />
      </div>
      {!hasPrice && (
        <p className="text-muted-foreground mt-3 text-sm">
          現在の株価が未入力のため、比較・安全率は参考値です
        </p>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  muted,
  badge,
  dataIndicator,
  highlighted,
}: {
  label: string;
  value: string;
  muted?: boolean;
  badge?: React.ReactNode;
  dataIndicator?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${muted ? 'opacity-60' : ''} ${highlighted ? 'animate-highlight' : ''}`}
      {...(dataIndicator ? { 'data-indicator': dataIndicator } : {})}
    >
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums" aria-label={`${label} ${value}`}>
        {value}
      </p>
      {badge && <div className="mt-2">{badge}</div>}
    </div>
  );
}

// ---------- Indicator Sections ----------

type FormatFn = (value: number | null) => string;

type IndicatorDef = {
  field: string;
  label: string;
  format: FormatFn;
};

type CategoryDef = {
  title: string;
  id: string;
  indicators: IndicatorDef[];
};

const CATEGORIES: CategoryDef[] = [
  {
    title: '収益性',
    id: 'profitability',
    indicators: [
      { field: 'equityRatio', label: '自己資本比率', format: formatPercentUnsigned },
      { field: 'netProfitMargin', label: '純利益率', format: formatPercentUnsigned },
      { field: 'operatingMargin', label: '売上営業利益率', format: formatPercentUnsigned },
    ],
  },
  {
    title: '成長性',
    id: 'growth',
    indicators: [
      { field: 'revenueGrowthRate', label: '売上高前年比成長率', format: formatPercent },
      { field: 'netIncomeGrowthRate', label: '純利益前年比成長率', format: formatPercent },
    ],
  },
  {
    title: 'キャッシュフロー',
    id: 'cashflow',
    indicators: [
      { field: 'operatingCF', label: '営業CF', format: formatCurrency },
      { field: 'investingCF', label: '投資CF', format: formatCurrency },
      { field: 'fcf', label: 'FCF', format: formatCurrency },
    ],
  },
  {
    title: '資本効率',
    id: 'efficiency',
    indicators: [
      { field: 'roe', label: 'ROE', format: formatPercentUnsigned },
      { field: 'roa', label: 'ROA', format: formatPercentUnsigned },
      { field: 'roic', label: 'ROIC', format: formatPercentUnsigned },
      { field: 'movingAverageROIC', label: '移動平均ROIC', format: formatPercentUnsigned },
    ],
  },
  {
    title: '株式指標',
    id: 'stock-metrics',
    indicators: [
      { field: 'eps', label: 'EPS', format: formatPerShare },
      { field: 'per', label: 'PER', format: formatMultiple },
      { field: 'pbr', label: 'PBR', format: formatMultiple },
    ],
  },
  {
    title: '理論価値',
    id: 'theory-value',
    indicators: [
      { field: 'businessValue', label: '事業価値', format: formatCurrency },
      { field: 'assetValue', label: '資産価値', format: formatCurrency },
      { field: 'theoryPrice', label: '現状理論株価', format: formatStockPrice },
      { field: 'growthTheoryPrice', label: '成長込理論株価', format: formatStockPrice },
    ],
  },
  {
    title: '理論PER系',
    id: 'theory-per',
    indicators: [
      { field: 'theoryMarketCap', label: '理論時価総額', format: formatCurrency },
      { field: 'theoryPER', label: '理論PER', format: formatMultiple },
      { field: 'futureTheoryMarketCap', label: '5年後理論時価総額', format: formatCurrency },
      { field: 'futureNetIncome', label: '6年目当期純利益', format: formatCurrency },
    ],
  },
  {
    title: '安全性',
    id: 'safety',
    indicators: [
      { field: 'safetyMarginCurrent', label: '安全域（現状）', format: formatCurrency },
      { field: 'safetyMarginGrowth', label: '安全域（成長込）', format: formatCurrency },
      { field: 'safetyRateCurrent', label: '安全率（現状）', format: formatPercent },
      { field: 'safetyRateGrowth', label: '安全率（成長込）', format: formatPercent },
      { field: 'idealBuyPriceCurrent', label: '理想購入株価（対現状）', format: formatStockPrice },
      { field: 'idealBuyPriceGrowth', label: '理想購入株価（対成長）', format: formatStockPrice },
    ],
  },
];

function IndicatorSection({
  category,
  results,
  changedFields,
}: {
  category: CategoryDef;
  results: IndicatorResults;
  changedFields: Set<string>;
}) {
  return (
    <section aria-labelledby={`${category.id}-heading`}>
      <h3 id={`${category.id}-heading`} className="mb-3 text-base font-semibold">
        {category.title}
      </h3>
      <dl className="divide-y rounded-lg border">
        {category.indicators.map((indicator) => {
          const calcResult = getIndicatorValue(results, indicator.field);
          const value = calcResult?.value ?? null;
          const formatted = indicator.format(value);
          const isChanged = changedFields.has(indicator.field);

          return (
            <div
              key={indicator.field}
              className={`flex items-center justify-between px-4 py-3 transition-colors ${isChanged ? 'animate-highlight' : ''}`}
              data-indicator={indicator.field}
            >
              <dt className="text-muted-foreground text-sm">{indicator.label}</dt>
              <dd
                className="font-medium tabular-nums"
                aria-label={`${indicator.label} ${formatted}`}
              >
                {formatted}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

// ---------- Main Component ----------

export function TheoryPriceSection({
  results,
  previousResults,
  currentStockPrice,
}: {
  results: IndicatorResults | null;
  previousResults?: IndicatorResults | null;
  currentStockPrice: number | null;
}) {
  const changedFields = useMemo(
    () => detectChangedFields(previousResults ?? null, results),
    [previousResults, results],
  );

  // useHighlight manages animation lifecycle: applies class → clears after duration → allows replay
  const highlighted = useHighlight(changedFields);

  if (!results) {
    return <TheoryPriceEmpty />;
  }

  return (
    <div className="space-y-8">
      <ComparisonSummary
        currentStockPrice={currentStockPrice}
        theoryPrice={results.period.theoryPrice}
        growthTheoryPrice={results.period.growthTheoryPrice}
        safetyRateCurrent={results.period.safetyRateCurrent}
        changedFields={highlighted}
      />

      <div className="space-y-6">
        {CATEGORIES.map((category) => (
          <IndicatorSection
            key={category.id}
            category={category}
            results={results}
            changedFields={highlighted}
          />
        ))}
      </div>
    </div>
  );
}
