/**
 * 財務グリッドの計算指標行
 *
 * 財務データグリッドの下部に表示する、入力値から自動算出される指標群。
 *
 * 重要: 計算ロジックはここに実装しない。
 * 必ず計算エンジン（ratios/stock-metrics/theory-price/safety/growth）の関数を呼び、
 * このモジュールは「null ガード＋表示整形」だけを担当する。
 * 以前はDCF式などがここに二重実装されており、エンジン側の仕様変更
 * （上限倍率・丸め・負値ガード）がグリッドに反映されず画面間で数値が食い違っていた。
 * エンジンを経由することで、ゴールデンテストの保護がグリッドにも及ぶ。
 */
import type { ParametersRow } from '@/lib/types/parameters';
import {
  calcEquityRatio,
  calcNetProfitMargin,
  calcOperatingMargin,
  calcROE,
  calcROA,
  calcROIC,
} from './ratios';
import { calcPER, calcPBR, calcFCF } from './stock-metrics';
import { calcYoYGrowthRate } from './growth';
import { calcBusinessValue, calcTheoryPrice } from './theory-price';
import { calcSafetyMargin, calcSafetyRate } from './safety';

/** 計算指標の定義 */
export type GridIndicator = {
  /** 識別キー */
  key: string;
  /** 日本語表示名 */
  label: string;
  /** 単位（表示用） */
  unit: string;
  /** 計算関数: 当期の入力値 + パラメータ → 表示文字列 */
  calc: (
    values: GridValues,
    params: ParametersRow | null,
    prevValues?: GridValues | null
  ) => string | null;
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
// ヘルパー関数（表示整形と null ガードのみ。計算はエンジンに委譲）
// ============================================================

/**
 * 自己資本の解決（エンジンの resolveEquity と同方針: 株主資本優先・純資産フォールバック）
 * グリッドは表示専用なので値だけ返す
 */
function gridEquity(v: GridValues): number | null {
  return v.shareholders_equity ?? v.equity;
}

/** % 表示（小数1桁）。値はエンジンで丸め済み（小数2桁）のものを表示用に整形する */
function fmtPct(value: number | null): string | null {
  if (value == null) return null;
  return value.toFixed(1) + '%';
}

/** 百万円表示 */
function millions(value: number | null): string | null {
  if (value == null) return null;
  return Math.round(value / 1_000_000).toLocaleString();
}

/** 円表示（整数）。エンジンが既に円未満を丸めた値を渡す前提 */
function yen(value: number | null): string | null {
  if (value == null) return null;
  return value.toLocaleString();
}

/**
 * 支払利息率と現行の負債調達コストは同一定義なので、値の算出を共有する。
 *
 * 税効果を含める仕様が確定するまでは表示行を分けたままにし、現在の数値契約だけを
 * 一箇所へ集約する。
 */
function gridInterestRate(values: GridValues): number | null {
  if (
    values.interest_expense == null ||
    values.interest_bearing_debt == null ||
    values.interest_bearing_debt === 0
  ) {
    return null;
  }
  return (values.interest_expense / values.interest_bearing_debt) * 100;
}

/**
 * 理論株価をエンジン経由で算出する（事業価値→資産価値→理論株価のチェーン）
 * theory_price / safety_margin / safety_rate で共有し、式の重複を排除する
 */
function gridTheoryPrice(
  v: GridValues,
  params: ParametersRow | null
): number | null {
  const equity = gridEquity(v);
  // 営業利益・自己資本は 0 も正当な値（赤字転落・債務超過）なので == null で判定する
  if (v.operating_income == null || equity == null || params == null)
    return null;
  const businessValue = calcBusinessValue(
    v.operating_income,
    params.tax_rate,
    params.discount_rate,
    params.growth_rate,
    params.cap_multiplier
  ).value;
  if (businessValue == null) return null;
  return calcTheoryPrice(
    businessValue,
    equity,
    v.interest_bearing_debt ?? 0,
    v.shares_outstanding
  ).value;
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
    calc: (v) => {
      const equity = gridEquity(v);
      if (equity == null || v.total_assets == null) return null;
      return fmtPct(calcEquityRatio(equity, v.total_assets).value);
    },
  },
  {
    key: 'net_profit_margin',
    label: '売上純利益率',
    unit: '%',
    calc: (v) => {
      if (v.net_income == null || v.revenue == null) return null;
      return fmtPct(calcNetProfitMargin(v.net_income, v.revenue).value);
    },
  },
  {
    key: 'operating_margin',
    label: '売上営業利益率',
    unit: '%',
    calc: (v) => {
      if (v.operating_income == null || v.revenue == null) return null;
      return fmtPct(calcOperatingMargin(v.operating_income, v.revenue).value);
    },
  },
  {
    key: 'revenue_growth',
    label: '前年比売上成長率',
    unit: '%',
    calc: (v, _p, prev) => {
      // 当期売上 0 は -100% として算出可能なので == null で判定（truthy 判定だと 0 を弾く）
      if (prev?.revenue == null || v.revenue == null) return null;
      return fmtPct(
        calcYoYGrowthRate(v.revenue, prev.revenue, '売上高', 'revenue').value
      );
    },
  },
  {
    key: 'profit_growth',
    label: '前年比利益成長率',
    unit: '%',
    calc: (v, _p, prev) => {
      if (prev?.net_income == null || v.net_income == null) return null;
      return fmtPct(
        calcYoYGrowthRate(v.net_income, prev.net_income, '純利益', 'net_income')
          .value
      );
    },
  },
  {
    key: 'roic',
    label: 'ROIC',
    unit: '%',
    calc: (v, params) => {
      const equity = gridEquity(v);
      // 税率はエンジンと同じくパラメータ必須（独自のデフォルト 0.3 を持つと前提が食い違う）
      if (v.operating_income == null || equity == null || params == null)
        return null;
      return fmtPct(
        calcROIC(
          v.operating_income,
          params.tax_rate,
          equity,
          v.interest_bearing_debt ?? 0
        ).value
      );
    },
  },
  {
    key: 'roe',
    label: 'ROE',
    unit: '%',
    calc: (v) => {
      const equity = gridEquity(v);
      if (v.net_income == null || equity == null) return null;
      return fmtPct(calcROE(v.net_income, equity).value);
    },
  },
  {
    key: 'roa',
    label: 'ROA',
    unit: '%',
    calc: (v) => {
      if (v.net_income == null || v.total_assets == null) return null;
      return fmtPct(calcROA(v.net_income, v.total_assets).value);
    },
  },
  {
    key: 'per',
    label: 'PER',
    unit: '倍',
    calc: (v) => {
      if (
        v.current_stock_price == null ||
        v.net_income == null ||
        v.shares_outstanding == null ||
        v.shares_outstanding === 0
      )
        return null;
      // エンジンと同じく丸め前の生EPSからPERを計算する
      const rawEps = v.net_income / v.shares_outstanding;
      const per = calcPER(v.current_stock_price, rawEps).value;
      return per == null ? null : per.toFixed(1);
    },
  },
  {
    key: 'pbr',
    label: 'PBR',
    unit: '倍',
    calc: (v) => {
      const equity = gridEquity(v);
      if (equity == null) return null;
      const pbr = calcPBR(
        v.current_stock_price,
        v.shares_outstanding,
        equity
      ).value;
      return pbr == null ? null : pbr.toFixed(2);
    },
  },
  {
    key: 'fcf',
    label: 'FCF',
    unit: '百万円',
    calc: (v) => millions(calcFCF(v.operating_cf, v.investing_cf).value),
  },
  {
    key: 'interest_rate',
    label: '支払利息率',
    unit: '%',
    calc: (v) => {
      // 支払利息 0 は利息率 0% として正当（truthy 判定だと弾かれていた）
      return fmtPct(gridInterestRate(v));
    },
  },
  {
    key: 'cost_of_debt',
    label: '負債調達コスト',
    unit: '%',
    // 注: 現仕様では支払利息率と同一定義（税効果を掛けるかは仕様未決定のため変更しない）
    calc: (v) => fmtPct(gridInterestRate(v)),
  },
  {
    key: 'business_value',
    label: '現状事業価値',
    unit: '百万円',
    calc: (v, params) => {
      if (v.operating_income == null || params == null) return null;
      return millions(
        calcBusinessValue(
          v.operating_income,
          params.tax_rate,
          params.discount_rate,
          params.growth_rate,
          params.cap_multiplier
        ).value
      );
    },
  },
  {
    key: 'asset_value',
    label: '現状資産価値',
    unit: '百万円',
    calc: (v) => millions(gridEquity(v)),
  },
  {
    key: 'theory_price',
    label: '現状理論株価',
    unit: '円',
    calc: (v, params) => yen(gridTheoryPrice(v, params)),
  },
  {
    key: 'safety_margin',
    label: '安全域（現状）',
    unit: '円',
    calc: (v, params) => {
      if (v.current_stock_price == null) return null;
      return yen(
        calcSafetyMargin(gridTheoryPrice(v, params), v.current_stock_price)
          .value
      );
    },
  },
  {
    key: 'safety_rate',
    label: '安全率（現状）',
    unit: '%',
    calc: (v, params) => {
      if (v.current_stock_price == null) return null;
      // エンジン経由なので「理論株価 ≤ 0 のとき算出不可」のガードも自動的に効く
      return fmtPct(
        calcSafetyRate(gridTheoryPrice(v, params), v.current_stock_price).value
      );
    },
  },
  {
    key: 'wacc',
    label: '資本調達コスト(WACC)',
    unit: '%',
    calc: (v, params) => {
      const equity = gridEquity(v);
      if (params == null || equity == null) return null;
      const debt = v.interest_bearing_debt ?? 0;
      const totalCapital = equity + debt;
      if (totalCapital === 0) return null;
      // 支払利息 0 は負債コスト 0 として扱う（== null のみ算出不可）
      const costOfDebt =
        debt > 0 && v.interest_expense != null
          ? (v.interest_expense / debt) * (1 - params.tax_rate)
          : 0;
      const costOfEquity = params.discount_rate;
      const wacc =
        (costOfEquity * equity) / totalCapital +
        (costOfDebt * debt) / totalCapital;
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
