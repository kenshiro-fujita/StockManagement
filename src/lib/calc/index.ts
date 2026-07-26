/**
 * 計算エンジン — 全指標の一括計算エントリーポイント
 *
 * 財務データ（1〜N期分）とパラメータ（割引率r, 成長率g, 実効税率, 上限倍率）を受け取り、
 * 単一期28種類の指標と移動平均ROICを一括計算して返す。
 * 山口揚平氏の理論株価算出手法がベース。
 *
 * 計算の依存関係（上から下に依存）:
 *   財務データ → 収益性指標（自己資本比率, 利益率）
 *   財務データ + パラメータ → 資本効率（ROIC）
 *   ROIC + 全期間データ → 移動平均ROIC
 *   営業利益 + パラメータ → 事業価値（DCF）
 *   事業価値 + 資産価値 - 負債 → 理論株価
 *   理論株価 - 現在株価 → 安全域・安全率
 *
 * 全ての計算結果は CalcResult<number> 型で返され、
 * 値だけでなく「数式・入力参照・端数処理ルール・calc_version」のメタデータも含む。
 * これにより CalcLogicPanel でユーザーが計算過程を検証できる（FR27, FR28）。
 */
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { IndicatorResults, CalcResult } from '@/lib/types/calc';
import {
  calcEquityRatio,
  calcNetProfitMargin,
  calcOperatingMargin,
  calcROE,
  calcROA,
  calcROIC,
} from './ratios';
import { calcEPS, calcPER, calcPBR, calcFCF } from './stock-metrics';
import { calcYoYGrowthRate, calcMovingAverageROIC } from './growth';
import {
  calcBusinessValue,
  calcAssetValue,
  calcTheoryPrice,
  calcGrowthTheoryPrice,
  calcTheoryMarketCap,
  calcTheoryPER,
  calcFutureTheoryMarketCap,
  calcFutureNetIncome,
} from './theory-price';
import { calcSafetyMargin, calcSafetyRate, calcIdealBuyPrice } from './safety';
import { resolveEquity } from './utils';
import {
  createCalcResult,
  createUnavailableResult,
  ROUNDING_RULE,
} from './result';

/**
 * 全指標を一括計算するエントリーポイント
 * @param financialData 財務データ（降順ソート済み、[0]が最新期）
 * @param parameters パラメータ
 */
export function calculateAllIndicators(
  financialData: readonly FullFinancialDataRow[],
  parameters: ParametersRow
): IndicatorResults {
  if (financialData.length === 0) {
    throw new Error('財務データが1件以上必要です');
  }

  // M3: 財務データを fiscal_year 降順にソート（最新期が先頭）
  const sorted = [...financialData].sort(
    (a, b) => b.fiscal_year - a.fiscal_year
  );

  const latest = sorted[0];
  if (!latest) {
    // 冒頭の入力検証と同じ不変条件を、添字アクセスの型境界でも保証します。
    throw new Error('財務データが1件以上必要です');
  }
  const previous = sorted[1] ?? null;
  const debt = latest.interest_bearing_debt ?? 0;

  // 自己資本の解決: 株主資本（shareholders_equity）優先、なければ純資産（equity）
  // どちらを使ったかは eq.field / eq.label として全指標のメタデータに伝播する
  const eq = resolveEquity(latest);

  // 収益性
  const equityRatio = calcEquityRatio(
    eq.value,
    latest.total_assets,
    eq.field,
    eq.label
  );
  const netProfitMargin = calcNetProfitMargin(
    latest.net_income,
    latest.revenue
  );
  const operatingMargin = calcOperatingMargin(
    latest.operating_income,
    latest.revenue
  );

  // 成長性（前年比）
  const revenueGrowthRate = previous
    ? calcYoYGrowthRate(latest.revenue, previous.revenue, '売上高', 'revenue')
    : createUnavailableResult('前年比売上成長率（前期データなし）');
  const netIncomeGrowthRate = previous
    ? calcYoYGrowthRate(
        latest.net_income,
        previous.net_income,
        '純利益',
        'net_income'
      )
    : createUnavailableResult('前年比純利益成長率（前期データなし）');

  // キャッシュフロー
  const operatingCF: CalcResult<number> = createCalcResult(
    latest.operating_cf,
    {
      formula: '営業CF（入力値）',
      inputs: [
        {
          label: '営業CF',
          value: latest.operating_cf ?? 0,
          field: 'operating_cf',
        },
      ],
      rounding: ROUNDING_RULE.inputValue,
    }
  );
  const investingCF: CalcResult<number> = createCalcResult(
    latest.investing_cf,
    {
      formula: '投資CF（入力値）',
      inputs: [
        {
          label: '投資CF',
          value: latest.investing_cf ?? 0,
          field: 'investing_cf',
        },
      ],
      rounding: ROUNDING_RULE.inputValue,
    }
  );
  const fcf = calcFCF(latest.operating_cf, latest.investing_cf);

  // 資本効率
  const roe = calcROE(latest.net_income, eq.value, eq.field, eq.label);
  const roa = calcROA(latest.net_income, latest.total_assets);
  const roic = calcROIC(
    latest.operating_income,
    parameters.tax_rate,
    eq.value,
    debt,
    eq.field,
    eq.label
  );

  // 移動平均ROIC（全期間データを使用）
  const roicValues = sorted.map((fd) => {
    const d = fd.interest_bearing_debt ?? 0;
    const fdEq = resolveEquity(fd);
    return calcROIC(
      fd.operating_income,
      parameters.tax_rate,
      fdEq.value,
      d,
      fdEq.field,
      fdEq.label
    ).value;
  });
  const movingAverageROIC = calcMovingAverageROIC(roicValues);

  // 株式指標
  const epsResult = calcEPS(latest.net_income, latest.shares_outstanding);
  // PER は丸め済み EPS からではなく生の EPS から計算する
  // （丸め誤差が PER に伝播して系統的にズレるのを防ぐ。表示用の丸めは calcPER 内で行う）
  const rawEps =
    latest.shares_outstanding == null || latest.shares_outstanding === 0
      ? null
      : latest.net_income / latest.shares_outstanding;
  const per = calcPER(latest.current_stock_price, rawEps);
  const pbr = calcPBR(
    latest.current_stock_price,
    latest.shares_outstanding,
    eq.value,
    eq.field,
    eq.label
  );
  const eps = epsResult;

  // 理論価値
  const businessValue = calcBusinessValue(
    latest.operating_income,
    parameters.tax_rate,
    parameters.discount_rate,
    parameters.growth_rate,
    parameters.cap_multiplier
  );
  const assetValue = calcAssetValue(eq.value, eq.field, eq.label);
  const theoryPrice =
    businessValue.value != null && assetValue.value != null
      ? calcTheoryPrice(
          businessValue.value,
          assetValue.value,
          debt,
          latest.shares_outstanding
        )
      : createUnavailableResult(
          '現状理論株価（事業価値または資産価値算出不可）'
        );
  const growthTheoryPrice = calcGrowthTheoryPrice(
    latest.operating_income,
    parameters.tax_rate,
    parameters.discount_rate,
    parameters.growth_rate,
    eq.value,
    debt,
    latest.shares_outstanding
  );

  // 理論PER系
  const theoryMarketCap = calcTheoryMarketCap(
    theoryPrice.value,
    latest.shares_outstanding
  );
  const theoryPER = calcTheoryPER(theoryMarketCap.value, latest.net_income);
  const futureTheoryMarketCap = calcFutureTheoryMarketCap(
    theoryMarketCap.value,
    parameters.growth_rate,
    5
  );
  const futureNetIncome = calcFutureNetIncome(
    latest.net_income,
    parameters.growth_rate,
    5
  );

  // 安全性
  const safetyMarginCurrent = calcSafetyMargin(
    theoryPrice.value,
    latest.current_stock_price,
    '現状'
  );
  const safetyMarginGrowth = calcSafetyMargin(
    growthTheoryPrice.value,
    latest.current_stock_price,
    '成長込'
  );
  const safetyRateCurrent = calcSafetyRate(
    theoryPrice.value,
    latest.current_stock_price,
    '現状'
  );
  const safetyRateGrowth = calcSafetyRate(
    growthTheoryPrice.value,
    latest.current_stock_price,
    '成長込'
  );
  const idealBuyPriceCurrent = calcIdealBuyPrice(theoryPrice.value, '現状');
  const idealBuyPriceGrowth = calcIdealBuyPrice(
    growthTheoryPrice.value,
    '成長込'
  );

  return {
    period: {
      equityRatio,
      netProfitMargin,
      operatingMargin,
      revenueGrowthRate,
      netIncomeGrowthRate,
      operatingCF,
      investingCF,
      fcf,
      roe,
      roa,
      roic,
      eps,
      per,
      pbr,
      businessValue,
      assetValue,
      theoryPrice,
      growthTheoryPrice,
      theoryPER,
      theoryMarketCap,
      futureTheoryMarketCap,
      futureNetIncome,
      safetyMarginCurrent,
      safetyMarginGrowth,
      safetyRateCurrent,
      safetyRateGrowth,
      idealBuyPriceCurrent,
      idealBuyPriceGrowth,
    },
    movingAverageROIC,
  };
}
