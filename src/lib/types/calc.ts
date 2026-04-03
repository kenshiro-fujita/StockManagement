/**
 * 計算エンジンの型定義
 *
 * このアプリの計算エンジンは「計算透明性」を最重要設計原則としている。
 * 全ての計算結果は「値だけ」ではなく「どうやって計算したか」のメタデータも返す。
 * これにより CalcLogicPanel（Story 4.6）でユーザーが計算過程を検証できる。
 */

/**
 * 計算ロジックのバージョン管理用定数
 * 計算ロジックを変更した際にバージョンを上げることで、
 * 「このデータはどのバージョンのロジックで計算されたか」を追跡できる。
 */
export const CALC_VERSION = 'v1.0.0';

/**
 * 計算に使用した入力値の参照情報（CalcLogicPanel で表示される）
 * - label: 日本語の表示名（例: "自己資本"）
 * - value: 計算に使った実際の値
 * - field: financial_data テーブルのカラム名（例: "equity"）
 * - period: どの決算期のデータか（例: "2024年度"）
 * - source: データの出所（例: "EDINET自動取得"）
 */
export type CalcInput = {
  label: string;
  value: number;
  field: string;
  period?: string;
  source?: string;
};

/**
 * 計算結果の透明性メタデータ（CalcLogicPanel で表示される4項目）
 * - formula: 計算式の日本語表記（例: "ROE = 純利益 ÷ 自己資本 × 100"）
 * - inputs: 計算に使った入力値の一覧
 * - rounding: 端数処理ルール（例: "小数点以下第2位を四捨五入"）
 * - calcVersion: 計算ロジックのバージョン（CALC_VERSION）
 */
export type CalcMetadata = {
  formula: string;
  inputs: CalcInput[];
  rounding: string;
  calcVersion: string;
};

/**
 * 透明性メタデータ付き計算結果
 * 全ての計算関数がこの型を返す。value が null の場合は「算出不可」を意味する。
 */
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
