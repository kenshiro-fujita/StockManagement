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
import { createClient } from '@/lib/supabase/server';
import { calculateAllIndicators } from '@/lib/calc';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { RosterCategory } from '@/lib/types/roster';

/**
 * 指標計算に必要な financial_data のカラム（select('*') を避けて転送量を抑える）。
 * Supabase の型推論は select 文字列のリテラル型に依存するため、
 * 連結ではなく1つの文字列リテラルにしておく必要がある
 */
const INDICATOR_COLUMNS =
  'id, stock_id, fiscal_year, fiscal_quarter, consolidation_type, revenue, operating_income, net_income, total_assets, equity, interest_bearing_debt, operating_cf, investing_cf, shares_outstanding, interest_expense, current_stock_price, cash_and_equivalents, current_assets, investments_and_other_assets, current_liabilities, non_current_liabilities, shareholders_equity, beta, input_unit';

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
export const getStocksWithIndicators = cache(async (): Promise<StockIndicatorData[]> => {
  const supabase = await createClient();

  // 3テーブルを並列クエリ（N+1回避）
  const [{ data: stocks }, { data: allFinancialData }, { data: allParameters }] =
    await Promise.all([
      supabase
        .from('stocks')
        .select('id, stock_code, company_name, market, sector, roster_category, rating, buy_priority')
        .order('created_at', { ascending: false }),
      supabase
        .from('financial_data')
        .select(INDICATOR_COLUMNS)
        .order('fiscal_year', { ascending: false }),
      supabase
        .from('parameters')
        .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier'),
    ]);

  if (!stocks || stocks.length === 0) return [];

  // stock_id ごとにグループ化
  const financialByStock = new Map<string, FullFinancialDataRow[]>();
  for (const fd of allFinancialData ?? []) {
    const list = financialByStock.get(fd.stock_id) ?? [];
    list.push(fd as FullFinancialDataRow);
    financialByStock.set(fd.stock_id, list);
  }

  const paramsByStock = new Map<string, ParametersRow>();
  for (const p of allParameters ?? []) {
    paramsByStock.set(p.stock_id, {
      id: p.id,
      stock_id: p.stock_id,
      discount_rate: Number(p.discount_rate),
      growth_rate: Number(p.growth_rate),
      tax_rate: Number(p.tax_rate),
      cap_multiplier: Number(p.cap_multiplier),
    });
  }

  return stocks.map((stock) => {
    const fd = financialByStock.get(stock.id) ?? [];
    const params = paramsByStock.get(stock.id) ?? null;

    let theoryPrice: number | null = null;
    let safetyRateCurrent: number | null = null;
    if (fd.length > 0 && params != null) {
      try {
        const results = calculateAllIndicators(fd, params);
        theoryPrice = results.period.theoryPrice.value;
        safetyRateCurrent = results.period.safetyRateCurrent.value;
      } catch {
        // 計算失敗時は null のまま
      }
    }

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
});
