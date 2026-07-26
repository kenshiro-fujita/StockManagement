/**
 * 銘柄一覧・比較・ポートフォリオが共有する指標入力の整形を担います。
 *
 * DB行のグループ化、NUMERIC値の正規化、計算失敗時の扱いを1か所に
 * 集約し、各画面で同じ銘柄が異なる手順で計算されることを防ぎます。
 */
import { calculateAllIndicators } from '@/lib/calc';
import type { IndicatorResults } from '@/lib/types/calc';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';

/** 指標計算に必要な財務列です。select('*') による過剰取得を避けます。 */
export const INDICATOR_COLUMNS =
  'id, stock_id, fiscal_year, fiscal_quarter, consolidation_type, revenue, operating_income, net_income, total_assets, equity, interest_bearing_debt, operating_cf, investing_cf, shares_outstanding, interest_expense, current_stock_price, cash_and_equivalents, current_assets, investments_and_other_assets, current_liabilities, non_current_liabilities, shareholders_equity, beta, input_unit';

/** Supabaseから取得した財務行に、画面横断のグループ化で必要な銘柄IDを加えます。 */
export type StockFinancialDataRow = FullFinancialDataRow & {
  stock_id: string;
};

/** SupabaseのNUMERIC値が文字列になっても計算境界でnumberへ正規化します。 */
type RawParametersRow = Omit<
  ParametersRow,
  'discount_rate' | 'growth_rate' | 'tax_rate' | 'cap_multiplier'
> & {
  discount_rate: number | string;
  growth_rate: number | string;
  tax_rate: number | string;
  cap_multiplier: number | string;
};

export type StockIndicatorSummary = {
  theoryPrice: number | null;
  safetyRateCurrent: number | null;
};

/** stock_idをキーに行をまとめ、一覧系画面の同一処理を共通化します。 */
export function groupByStockId<T extends { stock_id: string }>(
  rows: readonly T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const group = grouped.get(row.stock_id);
    if (group) {
      group.push(row);
    } else {
      grouped.set(row.stock_id, [row]);
    }
  }

  return grouped;
}

/** DBドライバー差に左右されない計算用パラメータへ変換します。 */
export function normalizeParameters(row: RawParametersRow): ParametersRow {
  return {
    id: row.id,
    stock_id: row.stock_id,
    discount_rate: Number(row.discount_rate),
    growth_rate: Number(row.growth_rate),
    tax_rate: Number(row.tax_rate),
    cap_multiplier: Number(row.cap_multiplier),
  };
}

/** 銘柄IDから引けるよう、正規化とMap生成を同じ境界で行います。 */
export function indexParametersByStockId(
  rows: readonly RawParametersRow[]
): Map<string, ParametersRow> {
  return new Map(rows.map((row) => [row.stock_id, normalizeParameters(row)]));
}

/**
 * 一覧系画面向けに全指標を安全に算出します。
 *
 * 一部銘柄の不完全な入力で一覧全体を壊さないという既存挙動を保つため、
 * 入力不足や計算不能はnullに正規化します。
 */
export function calculateStockIndicators(
  financialData: readonly FullFinancialDataRow[],
  parameters: ParametersRow | null
): IndicatorResults | null {
  if (financialData.length === 0 || parameters == null) {
    return null;
  }

  try {
    return calculateAllIndicators([...financialData], parameters);
  } catch {
    return null;
  }
}

/** 全指標から一覧・サイドバーで必要な値だけを取り出します。 */
export function calculateStockIndicatorSummary(
  financialData: readonly FullFinancialDataRow[],
  parameters: ParametersRow | null
): StockIndicatorSummary {
  const results = calculateStockIndicators(financialData, parameters);

  return {
    theoryPrice: results?.period.theoryPrice.value ?? null,
    safetyRateCurrent: results?.period.safetyRateCurrent.value ?? null,
  };
}
