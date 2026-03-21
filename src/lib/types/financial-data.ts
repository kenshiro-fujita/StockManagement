export type FullFinancialDataRow = {
  id: string;
  fiscal_year: number;
  fiscal_quarter: string;
  consolidation_type: string;
  revenue: number;
  operating_income: number;
  net_income: number;
  total_assets: number;
  equity: number;
  interest_bearing_debt: number | null;
  operating_cf: number | null;
  investing_cf: number | null;
  shares_outstanding: number | null;
  interest_expense: number | null;
  current_stock_price: number | null;
  input_unit: string;
};
