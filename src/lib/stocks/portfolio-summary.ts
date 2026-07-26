/**
 * ポートフォリオ全体の集計（サーバー専用）
 *
 * 全銘柄の取引履歴・財務データ・パラメータを取得し、銘柄ごとに
 * 保有ポジション・評価額・損益・売買シグナルを算出する。
 * /portfolio ページ（保有一覧・損益サマリー）で使う。
 */
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { calculateAllIndicators } from '@/lib/calc';
import {
  calcPosition,
  calcPositionValuation,
  getTradeSignal,
  idealBuyPriceFromTheory,
  type TransactionInput,
  type TradeSignal,
} from '@/lib/calc/portfolio';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';

const INDICATOR_COLUMNS =
  'id, stock_id, fiscal_year, fiscal_quarter, consolidation_type, revenue, operating_income, net_income, total_assets, equity, interest_bearing_debt, operating_cf, investing_cf, shares_outstanding, interest_expense, current_stock_price, cash_and_equivalents, current_assets, investments_and_other_assets, current_liabilities, non_current_liabilities, shareholders_equity, beta, input_unit';

/** 1銘柄ぶんのポートフォリオ行 */
export type PortfolioRow = {
  stockId: string;
  stockCode: string;
  companyName: string;
  quantity: number;
  averageCost: number | null;
  bookValue: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPL: number | null;
  unrealizedPLPercent: number | null;
  realizedPL: number;
  theoryPrice: number | null;
  idealBuyPrice: number | null;
  signal: TradeSignal;
  signalReason: string;
};

/** ポートフォリオ全体の合計 */
export type PortfolioTotals = {
  bookValue: number; // 保有中の取得原価合計
  marketValue: number; // 評価額合計
  unrealizedPL: number; // 含み損益合計
  unrealizedPLPercent: number | null; // 含み損益率
  realizedPL: number; // 実現損益合計
  holdingCount: number; // 保有銘柄数
};

export type PortfolioSummary = {
  rows: PortfolioRow[];
  totals: PortfolioTotals;
};

export const getPortfolioSummary = cache(async (): Promise<PortfolioSummary> => {
  const supabase = await createClient();

  const [{ data: stocks }, { data: allFinancialData }, { data: allParameters }, { data: allTx }] =
    await Promise.all([
      supabase
        .from('stocks')
        .select('id, stock_code, company_name')
        .order('created_at', { ascending: false }),
      supabase.from('financial_data').select(INDICATOR_COLUMNS).order('fiscal_year', { ascending: false }),
      supabase.from('parameters').select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier, projected_net_income'),
      supabase.from('transactions').select('stock_id, transaction_type, trade_date, quantity, unit_price, fee'),
    ]);

  const emptyTotals: PortfolioTotals = {
    bookValue: 0, marketValue: 0, unrealizedPL: 0, unrealizedPLPercent: null, realizedPL: 0, holdingCount: 0,
  };
  if (!stocks || stocks.length === 0) return { rows: [], totals: emptyTotals };

  // stock_id ごとにグループ化
  const fdByStock = new Map<string, FullFinancialDataRow[]>();
  for (const fd of allFinancialData ?? []) {
    const list = fdByStock.get(fd.stock_id) ?? [];
    list.push(fd as FullFinancialDataRow);
    fdByStock.set(fd.stock_id, list);
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
      projected_net_income: p.projected_net_income == null ? null : Number(p.projected_net_income),
    });
  }
  const txByStock = new Map<string, TransactionInput[]>();
  for (const t of allTx ?? []) {
    const list = txByStock.get(t.stock_id) ?? [];
    list.push({
      transaction_type: t.transaction_type,
      trade_date: t.trade_date,
      quantity: Number(t.quantity),
      unit_price: Number(t.unit_price),
      fee: Number(t.fee),
    });
    txByStock.set(t.stock_id, list);
  }

  const rows: PortfolioRow[] = [];
  for (const stock of stocks) {
    const txs = txByStock.get(stock.id) ?? [];
    // 取引のない銘柄はポートフォリオ表に出さない（保有・損益とも無いため）
    if (txs.length === 0) continue;

    const fd = fdByStock.get(stock.id) ?? [];
    const params = paramsByStock.get(stock.id) ?? null;
    const currentPrice = fd.length > 0 ? fd[0].current_stock_price : null;

    let theoryPrice: number | null = null;
    if (fd.length > 0 && params != null) {
      try {
        theoryPrice = calculateAllIndicators(fd, params).period.theoryPrice.value;
      } catch {
        // 計算失敗時は null
      }
    }

    const position = calcPosition(txs);
    const valuation = calcPositionValuation(position, currentPrice);
    const idealBuyPrice = idealBuyPriceFromTheory(theoryPrice);
    const sig = getTradeSignal({
      currentPrice,
      theoryPrice,
      idealBuyPrice,
      hasPosition: position.quantity > 0,
    });

    rows.push({
      stockId: stock.id,
      stockCode: stock.stock_code,
      companyName: stock.company_name,
      quantity: position.quantity,
      averageCost: position.averageCost,
      bookValue: position.bookValue,
      currentPrice,
      marketValue: valuation?.marketValue ?? null,
      unrealizedPL: valuation?.unrealizedPL ?? null,
      unrealizedPLPercent: valuation?.unrealizedPLPercent ?? null,
      realizedPL: position.realizedPL,
      theoryPrice,
      idealBuyPrice,
      signal: sig.signal,
      signalReason: sig.reason,
    });
  }

  // 合計を算出（保有中＝quantity>0 のみ簿価・評価額に算入。実現損益は全銘柄合算）
  const totals = rows.reduce<PortfolioTotals>((acc, r) => {
    if (r.quantity > 0) {
      acc.bookValue += r.bookValue;
      acc.marketValue += r.marketValue ?? 0;
      acc.holdingCount += 1;
    }
    acc.realizedPL += r.realizedPL;
    return acc;
  }, { ...emptyTotals });
  totals.unrealizedPL = totals.marketValue - totals.bookValue;
  totals.unrealizedPLPercent =
    totals.bookValue > 0 ? Math.round((totals.unrealizedPL / totals.bookValue) * 1000) / 10 : null;

  return { rows, totals };
});
