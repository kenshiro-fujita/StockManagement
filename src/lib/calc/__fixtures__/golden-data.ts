/**
 * ゴールデンテスト用データ — 1銘柄×3期分
 *
 * UXモックアップの計算例とPRD要件に基づいて作成したサンプルデータ。
 * 将来的にユーザーの実スプレッドシートデータで置き換える前提。
 *
 * 銘柄: テスト株式会社（架空）
 * パラメータ: r=8%, g=2%, 実効税率=30%, 上限倍率=10
 * すべての金額は円で保存済み（input_unit='yen'）
 */

import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';

export const GOLDEN_PARAMETERS: ParametersRow = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  stock_id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  discount_rate: 0.08,
  growth_rate: 0.02,
  tax_rate: 0.3,
  cap_multiplier: 10,
};

/** 3期分の財務データ（降順: 2024→2023→2022） */
export const GOLDEN_FINANCIAL_DATA: FullFinancialDataRow[] = [
  {
    // FY2024 — 最新期
    id: 'fd-2024',
    fiscal_year: 2024,
    fiscal_quarter: 'FY',
    consolidation_type: 'consolidated',
    revenue: 50_000_000_000,            // 500億円
    operating_income: 5_000_000_000,    // 50億円
    net_income: 3_000_000_000,          // 30億円
    total_assets: 40_000_000_000,       // 400億円
    equity: 20_000_000_000,             // 200億円
    interest_bearing_debt: 8_000_000_000, // 80億円
    operating_cf: 4_500_000_000,        // 45億円
    investing_cf: -2_000_000_000,       // -20億円
    shares_outstanding: 100_000_000,    // 1億株
    interest_expense: 200_000_000,      // 2億円
    current_stock_price: 250,           // 250円/株
    input_unit: 'yen',
  },
  {
    // FY2023 — 前期
    id: 'fd-2023',
    fiscal_year: 2023,
    fiscal_quarter: 'FY',
    consolidation_type: 'consolidated',
    revenue: 45_000_000_000,            // 450億円
    operating_income: 4_200_000_000,    // 42億円
    net_income: 2_500_000_000,          // 25億円
    total_assets: 38_000_000_000,       // 380億円
    equity: 18_000_000_000,             // 180億円
    interest_bearing_debt: 9_000_000_000, // 90億円
    operating_cf: 4_000_000_000,        // 40億円
    investing_cf: -1_800_000_000,       // -18億円
    shares_outstanding: 100_000_000,    // 1億株
    interest_expense: 250_000_000,      // 2.5億円
    current_stock_price: 220,           // 220円/株
    input_unit: 'yen',
  },
  {
    // FY2022 — 2期前
    id: 'fd-2022',
    fiscal_year: 2022,
    fiscal_quarter: 'FY',
    consolidation_type: 'consolidated',
    revenue: 42_000_000_000,            // 420億円
    operating_income: 3_800_000_000,    // 38億円
    net_income: 2_200_000_000,          // 22億円
    total_assets: 35_000_000_000,       // 350億円
    equity: 16_000_000_000,             // 160億円
    interest_bearing_debt: 10_000_000_000, // 100億円
    operating_cf: 3_500_000_000,        // 35億円
    investing_cf: -1_500_000_000,       // -15億円
    shares_outstanding: 100_000_000,    // 1億株
    interest_expense: 300_000_000,      // 3億円
    current_stock_price: 200,           // 200円/株
    input_unit: 'yen',
  },
];

/**
 * 期待される計算結果（FY2024 最新期、前期=FY2023）
 *
 * 各値の算出根拠:
 *
 * 【収益性】
 * - 自己資本比率 = 20,000,000,000 ÷ 40,000,000,000 × 100 = 50%
 * - 純利益率 = 3,000,000,000 ÷ 50,000,000,000 × 100 = 6%
 * - 営業利益率 = 5,000,000,000 ÷ 50,000,000,000 × 100 = 10%
 *
 * 【成長性】
 * - 売上成長率 = (50B - 45B) ÷ 45B × 100 = 11.11%
 * - 純利益成長率 = (3B - 2.5B) ÷ 2.5B × 100 = 20%
 *
 * 【CF】
 * - 営業CF = 4,500,000,000
 * - 投資CF = -2,000,000,000
 * - FCF = 4,500,000,000 + (-2,000,000,000) = 2,500,000,000
 *
 * 【資本効率】
 * - ROE = 3,000,000,000 ÷ 20,000,000,000 × 100 = 15%
 * - ROA = 3,000,000,000 ÷ 40,000,000,000 × 100 = 7.5%
 * - ROIC = 5,000,000,000 × 0.7 ÷ (20,000,000,000 + 8,000,000,000) × 100 = 12.5%
 *
 * 【株式指標】
 * - EPS = 3,000,000,000 ÷ 100,000,000 = 30円
 * - PER = 250 ÷ 30 = 8.33倍
 * - PBR = 250 × 100,000,000 ÷ 20,000,000,000 = 1.25倍
 *
 * 【理論価値】
 * - 事業価値 基本式: 5,000,000,000 × 0.7 ÷ 0.06 = 58,333,333,333
 * - 事業価値 上限: 5,000,000,000 × 10 × 0.7 = 35,000,000,000
 * - → min(58.3B, 35B) = 35,000,000,000（上限倍率適用）
 * - 資産価値 = 20,000,000,000
 * - 現状理論株価 = (35,000,000,000 + 20,000,000,000 - 8,000,000,000) ÷ 100,000,000 = 470 → floor = 470
 *
 * - 成長込事業価値(DCF) = 5,000,000,000 × 0.7 ÷ 0.06 = 58,333,333,333
 * - 成長込理論株価 = (58,333,333,333 + 20,000,000,000 - 8,000,000,000) ÷ 100,000,000
 *                   = 70,333,333,333 ÷ 100,000,000 = 703.33... → floor = 703
 *
 * 【理論PER系】
 * - 理論時価総額 = 470 × 100,000,000 = 47,000,000,000
 * - 理論PER = 47,000,000,000 ÷ 3,000,000,000 = 15.67倍
 * - 5年後理論時価総額 = 47,000,000,000 × (1.02)^5 = 51,892,145,794
 * - 6年目当期純利益 = 3,000,000,000 × (1.02)^5 = 3,312,242,413
 *
 * 【安全性】
 * - 安全域（現状） = 470 - 250 = 220
 * - 安全域（成長込） = 703 - 250 = 453
 * - 安全率（現状） = (470 - 250) ÷ 470 × 100 = 46.81%
 * - 安全率（成長込） = (703 - 250) ÷ 703 × 100 = 64.44%
 * - 理想購入株価（対現状） = 470 × 0.5 = 235 → floor = 235
 * - 理想購入株価（対成長） = 703 × 0.5 = 351.5 → floor = 351
 *
 * 【移動平均ROIC（3期分）】
 * - FY2024 ROIC = 12.5%
 * - FY2023 ROIC = 4,200,000,000 × 0.7 ÷ (18,000,000,000 + 9,000,000,000) × 100 = 10.89%
 * - FY2022 ROIC = 3,800,000,000 × 0.7 ÷ (16,000,000,000 + 10,000,000,000) × 100 = 10.23%
 * - 移動平均 = (12.5 + 10.89 + 10.23) ÷ 3 = 11.21%
 */
export const GOLDEN_EXPECTED = {
  // 収益性
  equityRatio: 50,
  netProfitMargin: 6,
  operatingMargin: 10,

  // 成長性
  revenueGrowthRate: 11.11,
  netIncomeGrowthRate: 20,

  // CF
  operatingCF: 4_500_000_000,
  investingCF: -2_000_000_000,
  fcf: 2_500_000_000,

  // 資本効率
  roe: 15,
  roa: 7.5,
  roic: 12.5,

  // 株式指標
  eps: 30,
  per: 8.33,
  pbr: 1.25,

  // 理論価値
  businessValue: 35_000_000_000,
  assetValue: 20_000_000_000,
  theoryPrice: 470,
  growthTheoryPrice: 703,

  // 理論PER系
  theoryMarketCap: 47_000_000_000,
  theoryPER: 15.67,
  futureTheoryMarketCap: Math.round(47_000_000_000 * Math.pow(1.02, 5)),
  futureNetIncome: Math.round(3_000_000_000 * Math.pow(1.02, 5)),

  // 安全性
  safetyMarginCurrent: 220,
  safetyMarginGrowth: 453,
  safetyRateCurrent: 46.81,
  safetyRateGrowth: 64.44,
  idealBuyPriceCurrent: 235,
  idealBuyPriceGrowth: 351,

  // 移動平均ROIC
  movingAverageROIC: 11.21,
} as const;
