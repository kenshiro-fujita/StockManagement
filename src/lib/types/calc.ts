/** calc_version — 計算ロジックのバージョン管理用定数 */
export const CALC_VERSION = 'v1.0.0';

/** 計算に使用した入力値の参照情報 */
export type CalcInput = {
  label: string;
  value: number;
  field: string;
  period?: string;
  source?: string;
};

/** 計算結果の透明性メタデータ */
export type CalcMetadata = {
  formula: string;
  inputs: CalcInput[];
  rounding: string;
  calcVersion: string;
};

/** 透明性メタデータ付き計算結果 */
export type CalcResult<T> = {
  value: T | null;
  metadata: CalcMetadata;
};

/** 単一期の指標計算結果 */
export type PeriodIndicators = {
  // 収益性
  equityRatio: CalcResult<number>;
  netProfitMargin: CalcResult<number>;
  operatingMargin: CalcResult<number>;

  // 成長性（前年比 — 前期データがない場合は null）
  revenueGrowthRate: CalcResult<number>;
  netIncomeGrowthRate: CalcResult<number>;

  // キャッシュフロー
  operatingCF: CalcResult<number>;
  investingCF: CalcResult<number>;
  fcf: CalcResult<number>;

  // 資本効率
  roe: CalcResult<number>;
  roa: CalcResult<number>;
  roic: CalcResult<number>;

  // 株式指標
  eps: CalcResult<number>;
  per: CalcResult<number>;
  pbr: CalcResult<number>;

  // 理論価値
  businessValue: CalcResult<number>;
  assetValue: CalcResult<number>;
  theoryPrice: CalcResult<number>;
  growthTheoryPrice: CalcResult<number>;

  // 理論PER系
  theoryPER: CalcResult<number>;
  theoryMarketCap: CalcResult<number>;
  futureTheoryMarketCap: CalcResult<number>;
  futureNetIncome: CalcResult<number>;

  // 安全性
  safetyMarginCurrent: CalcResult<number>;
  safetyMarginGrowth: CalcResult<number>;
  safetyRateCurrent: CalcResult<number>;
  safetyRateGrowth: CalcResult<number>;
  idealBuyPriceCurrent: CalcResult<number>;
  idealBuyPriceGrowth: CalcResult<number>;
};

/** 全指標の計算結果（移動平均ROIC を含む） */
export type IndicatorResults = {
  period: PeriodIndicators;
  movingAverageROIC: CalcResult<number>;
};
