'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import type { IndicatorResults, CalcResult, CalcMetadata, CalcInput } from '@/lib/types/calc';
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

import { getValuationLevel, type ValuationLevel } from '@/lib/calc/safety';

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
  expandedField,
  onToggle,
}: {
  currentStockPrice: number | null;
  theoryPrice: CalcResult<number>;
  growthTheoryPrice: CalcResult<number>;
  safetyRateCurrent: CalcResult<number>;
  changedFields: Set<string>;
  expandedField: string | null;
  onToggle: (field: string) => void;
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
          field="theoryPrice"
          metadata={theoryPrice.metadata}
          highlighted={changedFields.has('theoryPrice')}
          expandedField={expandedField}
          onToggle={onToggle}
        />
        <SummaryCard
          label="成長込理論株価"
          value={formatStockPrice(growthTheoryPrice.value)}
          field="growthTheoryPrice"
          metadata={growthTheoryPrice.metadata}
          highlighted={changedFields.has('growthTheoryPrice')}
          expandedField={expandedField}
          onToggle={onToggle}
        />
        <SummaryCard
          label="安全率（現状）"
          value={formatPercent(safetyRateCurrent.value)}
          field="safetyRateCurrent"
          metadata={safetyRateCurrent.metadata}
          badge={level ? <ValuationBadge level={level} /> : undefined}
          highlighted={changedFields.has('safetyRateCurrent')}
          expandedField={expandedField}
          onToggle={onToggle}
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
  field,
  metadata,
  highlighted,
  expandedField,
  onToggle,
}: {
  label: string;
  value: string;
  muted?: boolean;
  badge?: React.ReactNode;
  field?: string;
  metadata?: CalcMetadata;
  highlighted?: boolean;
  expandedField?: string | null;
  onToggle?: (field: string) => void;
}) {
  const isExpanded = field != null && expandedField === field;
  const isClickable = field != null && metadata != null && onToggle != null;

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${muted ? 'opacity-60' : ''} ${highlighted ? 'animate-highlight' : ''}`}
      {...(field ? { 'data-indicator': field } : {})}
    >
      <p className="text-muted-foreground text-sm">{label}</p>
      {isClickable ? (
        <button
          type="button"
          className="mt-1 text-xl font-bold tabular-nums text-teal-700 decoration-teal-400 decoration-dotted underline-offset-4 underline cursor-pointer hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 inline-flex items-center gap-1"
          onClick={() => onToggle(field)}
          aria-expanded={isExpanded}
          aria-label={`${label} ${value} — クリックして計算ロジックを${isExpanded ? '閉じる' : '開く'}`}
        >
          {value}
          {isExpanded
            ? <ChevronUp className="h-4 w-4" aria-hidden="true" />
            : <ChevronDown className="h-4 w-4" aria-hidden="true" />
          }
        </button>
      ) : (
        <p className="mt-1 text-xl font-bold tabular-nums" aria-label={`${label} ${value}`}>
          {value}
        </p>
      )}
      {badge && <div className="mt-2">{badge}</div>}
      {isExpanded && metadata && <CalcLogicPanel metadata={metadata} />}
    </div>
  );
}

// ---------- CalcLogicPanel ----------

function InputRefItem({ input }: { input: CalcInput }) {
  const periodLabel = input.period ? `（${input.period}）` : '';
  const sourceLabel = input.source ? ` — ${input.source}` : '';
  return (
    <li className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">
        {input.label}{periodLabel}{sourceLabel}
      </span>
      <span className="font-medium tabular-nums whitespace-nowrap">
        {input.value.toLocaleString()}
      </span>
    </li>
  );
}

function CalcLogicPanel({ metadata }: { metadata: CalcMetadata }) {
  return (
    <div
      className="mt-2 rounded-md border border-teal-200 bg-teal-50/50 p-4 text-sm"
      role="region"
      aria-label="計算ロジック詳細"
    >
      <dl className="space-y-3">
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">数式</dt>
          <dd className="mt-0.5 font-mono text-sm">{metadata.formula}</dd>
        </div>

        {metadata.inputs.length > 0 && (
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">入力値</dt>
            <dd className="mt-1">
              <ul className="space-y-1">
                {metadata.inputs.map((input, i) => (
                  <InputRefItem key={`${input.field}-${i}`} input={input} />
                ))}
              </ul>
            </dd>
          </div>
        )}

        <div className="flex gap-6">
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">端数処理</dt>
            <dd className="mt-0.5">{metadata.rounding}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">calc_version</dt>
            <dd className="mt-0.5 font-mono">{metadata.calcVersion}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

/** Clickable indicator value that toggles CalcLogicPanel */
function ClickableValue({
  formatted,
  label,
  metadata,
  expandedField,
  field,
  onToggle,
}: {
  formatted: string;
  label: string;
  metadata: CalcMetadata | undefined;
  expandedField: string | null;
  field: string;
  onToggle: (field: string) => void;
}) {
  if (!metadata) {
    return (
      <span className="font-medium tabular-nums" aria-label={`${label} ${formatted}`}>
        {formatted}
      </span>
    );
  }

  const isExpanded = expandedField === field;

  return (
    <span>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium tabular-nums text-teal-700 decoration-teal-400 decoration-dotted underline-offset-4 underline cursor-pointer hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
        onClick={() => onToggle(field)}
        aria-expanded={isExpanded}
        aria-label={`${label} ${formatted} — クリックして計算ロジックを${isExpanded ? '閉じる' : '開く'}`}
      >
        {formatted}
        {isExpanded
          ? <ChevronUp className="h-3 w-3" aria-hidden="true" />
          : <ChevronDown className="h-3 w-3" aria-hidden="true" />
        }
      </button>
    </span>
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
  expandedField,
  onToggle,
}: {
  category: CategoryDef;
  results: IndicatorResults;
  changedFields: Set<string>;
  expandedField: string | null;
  onToggle: (field: string) => void;
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
          const isExpanded = expandedField === indicator.field;

          return (
            <div
              key={indicator.field}
              className={`px-4 py-3 transition-colors ${isChanged ? 'animate-highlight' : ''}`}
              data-indicator={indicator.field}
            >
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground text-sm">{indicator.label}</dt>
                <dd>
                  <ClickableValue
                    formatted={formatted}
                    label={indicator.label}
                    metadata={calcResult?.metadata}
                    expandedField={expandedField}
                    field={indicator.field}
                    onToggle={onToggle}
                  />
                </dd>
              </div>
              {isExpanded && calcResult?.metadata && (
                <CalcLogicPanel metadata={calcResult.metadata} />
              )}
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

  // CalcLogicPanel toggle state — only one panel open at a time
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((field: string) => {
    setExpandedField((prev) => (prev === field ? null : field));
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (expandedField && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpandedField(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedField]);

  if (!results) {
    return <TheoryPriceEmpty />;
  }

  return (
    <div className="space-y-8" ref={containerRef}>
      <ComparisonSummary
        currentStockPrice={currentStockPrice}
        theoryPrice={results.period.theoryPrice}
        growthTheoryPrice={results.period.growthTheoryPrice}
        safetyRateCurrent={results.period.safetyRateCurrent}
        changedFields={highlighted}
        expandedField={expandedField}
        onToggle={handleToggle}
      />

      <div className="space-y-6">
        {CATEGORIES.map((category) => (
          <IndicatorSection
            key={category.id}
            category={category}
            results={results}
            changedFields={highlighted}
            expandedField={expandedField}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}
