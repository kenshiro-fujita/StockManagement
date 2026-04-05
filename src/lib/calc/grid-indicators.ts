/**
 * 財務グリッドの計算指標行
 *
 * 財務データグリッドの下部に表示する、入力値から自動算出される指標群。
 * 各関数は純粋関数で、入力値を受け取って計算結果を返す。
 */
import type { ParametersRow } from '@/lib/types/parameters';

/** 計算指標の定義 */
export type GridIndicator = {
  /** 識別キー */
  key: string;
  /** 日本語表示名 */
  label: string;
  /** 単位（表示用） */
  unit: string;
  /** 計算関数: 当期の入力値 + パラメータ → 表示文字列 */
  calc: (values: GridValues, params: ParametersRow | null, prevValues?: GridValues | null) => string | null;
};

/** グリッドの1列（1年度）分の入力値（百万円→円変換済み） */
export type GridValues = {
  revenue: number | null;
  operating_income: number | null;
  net_income: number | null;
  total_assets: number | null;
  equity: number | null;
  interest_bearing_debt: number | null;
  operating_cf: number | null;
  investing_cf: number | null;
  shares_outstanding: number | null;
  interest_expense: number | null;
  current_stock_price: number | null;
  shareholders_equity: number | null;
};

// ============================================================
// ヘルパー関数
// ============================================================

/** 安全な除算（ゼロ除算防止）→ パーセント表示 */
function pct(numerator: number | null, denominator: number | null): string | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return ((numerator / denominator) * 100).toFixed(1) + '%';
}

/** 安全な除算 → 小数2桁 */
function ratio2(numerator: number | null, denominator: number | null): string | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator).toFixed(2);
}

/** 百万円表示 */
function millions(value: number | null): string | null {
  if (value == null) return null;
  return Math.round(value / 1_000_000).toLocaleString();
}

/** 円表示（整数） */
function yen(value: number | null): string | null {
  if (value == null) return null;
  return Math.floor(value).toLocaleString();
}

// ============================================================
// 計算指標の定義
// ============================================================

/** 財務グリッドに表示する計算指標のリスト */
export const GRID_INDICATORS: GridIndicator[] = [
  {
    key: 'equity_ratio',
    label: '自己資本比率',
    unit: '%',
    calc: (v) => pct(v.equity, v.total_assets),
  },
  {
    key: 'net_profit_margin',
    label: '売上純利益率',
    unit: '%',
    calc: (v) => pct(v.net_income, v.revenue),
  },
  {
    key: 'operating_margin',
    label: '売上営業利益率',
    unit: '%',
    calc: (v) => pct(v.operating_income, v.revenue),
  },
  {
    key: 'revenue_growth',
    label: '前年比売上成長率',
    unit: '%',
    calc: (v, _p, prev) => {
      if (!prev?.revenue || !v.revenue) return null;
      return (((v.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100).toFixed(1) + '%';
    },
  },
  {
    key: 'profit_growth',
    label: '前年比利益成長率',
    unit: '%',
    calc: (v, _p, prev) => {
      if (!prev?.net_income || !v.net_income) return null;
      return (((v.net_income - prev.net_income) / Math.abs(prev.net_income)) * 100).toFixed(1) + '%';
    },
  },
  {
    key: 'roic',
    label: 'ROIC',
    unit: '%',
    calc: (v, params) => {
      const taxRate = params?.tax_rate ?? 0.3;
      const debt = v.interest_bearing_debt ?? 0;
      const invested = (v.equity ?? 0) + debt;
      if (!v.operating_income || invested === 0) return null;
      return ((v.operating_income * (1 - taxRate) / invested) * 100).toFixed(1) + '%';
    },
  },
  {
    key: 'roe',
    label: 'ROE',
    unit: '%',
    calc: (v) => pct(v.net_income, v.equity),
  },
  {
    key: 'roa',
    label: 'ROA',
    unit: '%',
    calc: (v) => pct(v.net_income, v.total_assets),
  },
  {
    key: 'per',
    label: 'PER',
    unit: '倍',
    calc: (v) => {
      if (!v.current_stock_price || !v.net_income || !v.shares_outstanding) return null;
      const eps = v.net_income / v.shares_outstanding;
      if (eps === 0) return null;
      return (v.current_stock_price / eps).toFixed(1);
    },
  },
  {
    key: 'pbr',
    label: 'PBR',
    unit: '倍',
    calc: (v) => {
      if (!v.current_stock_price || !v.shares_outstanding || !v.equity || v.equity === 0) return null;
      return ((v.current_stock_price * v.shares_outstanding) / v.equity).toFixed(2);
    },
  },
  {
    key: 'fcf',
    label: 'FCF',
    unit: '百万円',
    calc: (v) => {
      if (v.operating_cf == null || v.investing_cf == null) return null;
      return Math.round((v.operating_cf + v.investing_cf) / 1_000_000).toLocaleString();
    },
  },
  {
    key: 'interest_rate',
    label: '支払利息率',
    unit: '%',
    calc: (v) => pct(v.interest_expense, v.interest_bearing_debt),
  },
  {
    key: 'cost_of_debt',
    label: '負債調達コスト',
    unit: '%',
    calc: (v) => pct(v.interest_expense, v.interest_bearing_debt),
  },
  {
    key: 'business_value',
    label: '現状事業価値',
    unit: '百万円',
    calc: (v, params) => {
      if (!v.operating_income || !params) return null;
      const afterTax = v.operating_income * (1 - params.tax_rate);
      const rMinusG = params.discount_rate - params.growth_rate;
      if (rMinusG <= 0) return null;
      const dcf = afterTax / rMinusG;
      const cap = v.operating_income * params.cap_multiplier * (1 - params.tax_rate);
      return millions(Math.min(dcf, cap));
    },
  },
  {
    key: 'asset_value',
    label: '現状資産価値',
    unit: '百万円',
    calc: (v) => millions(v.equity),
  },
  {
    key: 'theory_price',
    label: '現状理論株価',
    unit: '円',
    calc: (v, params) => {
      if (!v.operating_income || !v.equity || !v.shares_outstanding || !params) return null;
      if (v.shares_outstanding === 0) return null;
      const afterTax = v.operating_income * (1 - params.tax_rate);
      const rMinusG = params.discount_rate - params.growth_rate;
      if (rMinusG <= 0) return null;
      const dcf = afterTax / rMinusG;
      const cap = v.operating_income * params.cap_multiplier * (1 - params.tax_rate);
      const bv = Math.min(dcf, cap);
      const debt = v.interest_bearing_debt ?? 0;
      return yen((bv + v.equity - debt) / v.shares_outstanding);
    },
  },
  {
    key: 'safety_margin',
    label: '安全域（現状）',
    unit: '円',
    calc: (v, params) => {
      if (!v.current_stock_price || !v.operating_income || !v.equity || !v.shares_outstanding || !params) return null;
      if (v.shares_outstanding === 0) return null;
      const afterTax = v.operating_income * (1 - params.tax_rate);
      const rMinusG = params.discount_rate - params.growth_rate;
      if (rMinusG <= 0) return null;
      const dcf = afterTax / rMinusG;
      const cap = v.operating_income * params.cap_multiplier * (1 - params.tax_rate);
      const bv = Math.min(dcf, cap);
      const debt = v.interest_bearing_debt ?? 0;
      const tp = Math.floor((bv + v.equity - debt) / v.shares_outstanding);
      return yen(tp - v.current_stock_price);
    },
  },
  {
    key: 'safety_rate',
    label: '安全率（現状）',
    unit: '%',
    calc: (v, params) => {
      if (!v.current_stock_price || !v.operating_income || !v.equity || !v.shares_outstanding || !params) return null;
      if (v.shares_outstanding === 0) return null;
      const afterTax = v.operating_income * (1 - params.tax_rate);
      const rMinusG = params.discount_rate - params.growth_rate;
      if (rMinusG <= 0) return null;
      const dcf = afterTax / rMinusG;
      const cap = v.operating_income * params.cap_multiplier * (1 - params.tax_rate);
      const bv = Math.min(dcf, cap);
      const debt = v.interest_bearing_debt ?? 0;
      const tp = (bv + v.equity - debt) / v.shares_outstanding;
      if (tp === 0) return null;
      return (((tp - v.current_stock_price) / tp) * 100).toFixed(1) + '%';
    },
  },
  {
    key: 'wacc',
    label: '資本調達コスト(WACC)',
    unit: '%',
    calc: (v, params) => {
      if (!params || !v.equity || !v.interest_expense) return null;
      const debt = v.interest_bearing_debt ?? 0;
      const totalCapital = v.equity + debt;
      if (totalCapital === 0) return null;
      const costOfDebt = debt > 0 ? (v.interest_expense / debt) * (1 - params.tax_rate) : 0;
      const costOfEquity = params.discount_rate;
      const wacc = (costOfEquity * v.equity / totalCapital) + (costOfDebt * debt / totalCapital);
      return (wacc * 100).toFixed(2) + '%';
    },
  },
  {
    key: 'theoretical_discount_rate',
    label: '理論割引率',
    unit: '%',
    calc: (_v, params) => {
      if (!params) return null;
      return (params.discount_rate * 100).toFixed(1) + '%';
    },
  },
];
