/**
 * 銘柄一覧 + 指標計算の共有データ取得（サーバー専用）
 *
 * /stocks のレイアウト（サイドバー）とページ（一覧表）は同じ
 * 「全銘柄 × 全財務データ + 指標計算」を必要とする。
 * React の cache() でラップすることで、同一リクエスト内では
 * クエリと計算が1回だけ実行され、layout と page で結果を共有できる。
 * 以前は両者がそれぞれ全件取得 + calculateAllIndicators しており、
 * 1ページ表示で財務データ全件の転送と計算が2回走っていた。
 */
import { cache } from 'react';
import { assertQueriesSucceeded } from '@/lib/supabase/query-error';
import { createClient } from '@/lib/supabase/server';
import {
  calculateStockIndicatorSummary,
  groupByStockId,
  indexParametersByStockId,
  INDICATOR_COLUMNS,
  type StockFinancialDataRow,
} from '@/lib/stocks/indicator-data';
import type { RosterCategory } from '@/lib/types/roster';

/** 1銘柄ぶんの基本情報 + 算出済み指標 */
export type StockIndicatorData = {
  id: string;
  stock_code: string;
  company_name: string;
  market: string | null;
  sector: string | null;
  roster_category: RosterCategory | null;
  rating: number | null;
  buy_priority: number | null;
  theoryPrice: number | null;
  safetyRateCurrent: number | null;
};

/**
 * 全銘柄を指標付きで取得する。
 * cache() により同一リクエスト内では1回しか実行されない（layout/page で共有）。
 */
export const getStocksWithIndicators = cache(
  async (): Promise<StockIndicatorData[]> => {
    const supabase = await createClient();

    // 3テーブルを並列クエリ（N+1回避）
    const queryResults = await Promise.all([
      supabase
        .from('stocks')
        .select(
          'id, stock_code, company_name, market, sector, roster_category, rating, buy_priority'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('financial_data')
        .select(INDICATOR_COLUMNS)
        .order('fiscal_year', { ascending: false }),
      supabase
        .from('parameters')
        .select(
          'id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier'
        ),
    ]);
    assertQueriesSucceeded('銘柄指標の取得', queryResults);

    const [
      { data: stocks },
      { data: allFinancialData },
      { data: allParameters },
    ] = queryResults;

    if (!stocks || stocks.length === 0) return [];

    const financialByStock = groupByStockId(
      (allFinancialData ?? []) as StockFinancialDataRow[]
    );
    const paramsByStock = indexParametersByStockId(allParameters ?? []);

    return stocks.map((stock) => {
      const fd = financialByStock.get(stock.id) ?? [];
      const params = paramsByStock.get(stock.id) ?? null;
      const { theoryPrice, safetyRateCurrent } = calculateStockIndicatorSummary(
        fd,
        params
      );

      return {
        id: stock.id,
        stock_code: stock.stock_code,
        company_name: stock.company_name,
        market: stock.market,
        sector: stock.sector,
        roster_category: stock.roster_category,
        rating: stock.rating,
        buy_priority: stock.buy_priority,
        theoryPrice,
        safetyRateCurrent,
      };
    });
  }
);
