/**
 * 銘柄詳細ページのクライアントサイド・ラッパー
 *
 * サーバーで取得した財務データとパラメータを受け取り、
 * クライアントサイドで理論株価を計算する（useMemo）。
 *
 * パラメータ変更時の動作:
 * 1. ParameterSection からコールバックで新パラメータを受け取る
 * 2. 現在の計算結果を「前回の結果」として保存（ハイライトアニメーション用）
 * 3. 新パラメータで再計算（useMemo が自動的に再実行）
 * 4. TheoryPriceSection が前回/今回の差分を検出し、変更フィールドをハイライト
 */
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
import { EdinetSearch } from '@/components/stocks/edinet-search';
import { AIResearchSection } from '@/components/stocks/ai-research-section';

export function StockDetailClient({
  stockId,
  stockCode,
  financialData,
  initialParameters,
  overviewContent,
}: {
  stockId: string;
  stockCode: string;
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
      edinetContent={
        <EdinetSearch stockId={stockId} stockCode={stockCode} />
      }
      aiResearchContent={
        <AIResearchSection stockId={stockId} />
      }
    />
  );
}
