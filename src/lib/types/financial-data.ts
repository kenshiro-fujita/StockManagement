/**
 * 計算エンジンと財務入力UIが共有する財務データです。
 *
 * DB行から利用する列だけを選ぶことで、スキーマと同じ型を手書きで
 * 二重管理せず、認証情報やタイムスタンプも計算層へ持ち込みません。
 */
import type { Tables } from '@/lib/types/database';

export type FullFinancialDataRow = Pick<
  Tables<'financial_data'>,
  | 'id'
  | 'fiscal_year'
  | 'fiscal_quarter'
  | 'consolidation_type'
  | 'revenue'
  | 'operating_income'
  | 'net_income'
  | 'total_assets'
  | 'equity'
  | 'interest_bearing_debt'
  | 'operating_cf'
  | 'investing_cf'
  | 'shares_outstanding'
  | 'interest_expense'
  | 'current_stock_price'
  | 'cash_and_equivalents'
  | 'current_assets'
  | 'investments_and_other_assets'
  | 'current_liabilities'
  | 'non_current_liabilities'
  | 'shareholders_equity'
  | 'beta'
  | 'input_unit'
>;
