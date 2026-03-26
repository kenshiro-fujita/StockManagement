'use client';

import { useMemo, useState, useCallback } from 'react';
import { calculateAllIndicators } from '@/lib/calc';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { IndicatorResults } from '@/lib/types/calc';
import { StockDetailTabs } from '@/components/stocks/stock-detail-tabs';
import { TheoryPriceSection } from '@/components/stocks/theory-price-section';
import { FinancialDataSection } from '@/components/stocks/financial-data-section';
import { ParameterSection } from '@/components/stocks/parameter-section';

export function StockDetailClient({
  stockId,
  financialData,
  initialParameters,
  overviewContent,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
  initialParameters: ParametersRow | null;
  overviewContent: React.ReactNode;
}) {
  const [parameters, setParameters] = useState<ParametersRow | null>(initialParameters);
  const [prevResults, setPrevResults] = useState<IndicatorResults | null>(null);

  const indicatorResults = useMemo<IndicatorResults | null>(() => {
    if (financialData.length === 0 || parameters == null) return null;
    try {
      return calculateAllIndicators(financialData, parameters);
    } catch {
      return null;
    }
  }, [financialData, parameters]);

  const handleParametersChange = useCallback((newParams: ParametersRow) => {
    // 現在の結果を「前回の結果」として保存（ハイライト用）
    setPrevResults(indicatorResults);
    setParameters(newParams);
  }, [indicatorResults]);

  const latestStockPrice = financialData.length > 0
    ? financialData[0].current_stock_price
    : null;

  return (
    <StockDetailTabs
      overviewContent={overviewContent}
      theoryPriceContent={
        <TheoryPriceSection
          results={indicatorResults}
          previousResults={prevResults}
          currentStockPrice={latestStockPrice}
        />
      }
      financialContent={
        <FinancialDataSection
          stockId={stockId}
          financialData={financialData}
        />
      }
      parametersContent={
        <ParameterSection
          stockId={stockId}
          initialParameters={initialParameters}
          onParametersChange={handleParametersChange}
        />
      }
    />
  );
}
