import { describe, it, expect } from 'vitest';
import { calculateAllIndicators } from './index';
import {
  GOLDEN_FINANCIAL_DATA,
  GOLDEN_PARAMETERS,
  GOLDEN_EXPECTED,
} from './__fixtures__/golden-data';

/**
 * ゴールデンテスト — 1銘柄×3期分
 *
 * テストケース（1銘柄×3期分）でスプレッドシートと同一の計算結果を出力することを検証する。
 * 差分がある場合は端数処理・単位・期ズレ・入力マッピングのいずれかとして理由を明記する。
 *
 * 現在のテストデータはUXモックアップの計算例をベースに作成した合理的なサンプル。
 * 将来的にユーザーの実スプレッドシートデータで置き換える前提。
 */
describe('ゴールデンテスト（FY2024 最新期）', () => {
  const result = calculateAllIndicators(GOLDEN_FINANCIAL_DATA, GOLDEN_PARAMETERS);
  const p = result.period;

  describe('収益性指標', () => {
    it('自己資本比率 = 50%', () => {
      expect(p.equityRatio.value).toBe(GOLDEN_EXPECTED.equityRatio);
    });

    it('純利益率 = 6%', () => {
      expect(p.netProfitMargin.value).toBe(GOLDEN_EXPECTED.netProfitMargin);
    });

    it('売上営業利益率 = 10%', () => {
      expect(p.operatingMargin.value).toBe(GOLDEN_EXPECTED.operatingMargin);
    });
  });

  describe('成長性指標', () => {
    it('売上高前年比成長率 = 11.11%', () => {
      expect(p.revenueGrowthRate.value).toBe(GOLDEN_EXPECTED.revenueGrowthRate);
    });

    it('純利益前年比成長率 = 20%', () => {
      expect(p.netIncomeGrowthRate.value).toBe(GOLDEN_EXPECTED.netIncomeGrowthRate);
    });
  });

  describe('キャッシュフロー指標', () => {
    it('営業CF = 4,500,000,000円', () => {
      expect(p.operatingCF.value).toBe(GOLDEN_EXPECTED.operatingCF);
    });

    it('投資CF = -2,000,000,000円', () => {
      expect(p.investingCF.value).toBe(GOLDEN_EXPECTED.investingCF);
    });

    it('FCF = 2,500,000,000円', () => {
      expect(p.fcf.value).toBe(GOLDEN_EXPECTED.fcf);
    });
  });

  describe('資本効率指標', () => {
    it('ROE = 15%', () => {
      expect(p.roe.value).toBe(GOLDEN_EXPECTED.roe);
    });

    it('ROA = 7.5%', () => {
      expect(p.roa.value).toBe(GOLDEN_EXPECTED.roa);
    });

    it('ROIC = 12.5%', () => {
      expect(p.roic.value).toBe(GOLDEN_EXPECTED.roic);
    });

    it('移動平均ROIC（3期平均）= 11.21%', () => {
      expect(result.movingAverageROIC.value).toBe(GOLDEN_EXPECTED.movingAverageROIC);
    });
  });

  describe('株式指標', () => {
    it('EPS = 30円', () => {
      expect(p.eps.value).toBe(GOLDEN_EXPECTED.eps);
    });

    it('PER = 8.33倍', () => {
      expect(p.per.value).toBe(GOLDEN_EXPECTED.per);
    });

    it('PBR = 1.25倍', () => {
      expect(p.pbr.value).toBe(GOLDEN_EXPECTED.pbr);
    });
  });

  describe('理論価値', () => {
    it('事業価値 = 50,000,000,000円', () => {
      expect(p.businessValue.value).toBe(GOLDEN_EXPECTED.businessValue);
      expect(p.businessValue.metadata.formula).toContain('事業価値倍率');
    });

    it('資産価値 = 20,000,000,000円', () => {
      expect(p.assetValue.value).toBe(GOLDEN_EXPECTED.assetValue);
    });

    it('現状理論株価 = 700円', () => {
      expect(p.theoryPrice.value).toBe(GOLDEN_EXPECTED.theoryPrice);
    });

    it('成長込理論株価 = 567円', () => {
      expect(p.growthTheoryPrice.value).toBe(GOLDEN_EXPECTED.growthTheoryPrice);
    });
  });

  describe('理論PER系', () => {
    it('理論時価総額 = 70,000,000,000円', () => {
      expect(p.theoryMarketCap.value).toBe(GOLDEN_EXPECTED.theoryMarketCap);
    });

    it('理論PER = 23.33倍', () => {
      expect(p.theoryPER.value).toBe(GOLDEN_EXPECTED.theoryPER);
    });

    it('5年後理論時価総額', () => {
      expect(p.futureTheoryMarketCap.value).toBe(GOLDEN_EXPECTED.futureTheoryMarketCap);
    });

    it('6年目当期純利益', () => {
      expect(p.futureNetIncome.value).toBe(GOLDEN_EXPECTED.futureNetIncome);
    });
  });

  describe('安全性指標', () => {
    it('安全域（現状）= 450円', () => {
      expect(p.safetyMarginCurrent.value).toBe(GOLDEN_EXPECTED.safetyMarginCurrent);
    });

    it('安全域（成長込）= 317円', () => {
      expect(p.safetyMarginGrowth.value).toBe(GOLDEN_EXPECTED.safetyMarginGrowth);
    });

    it('安全率（現状）= 64.29%', () => {
      expect(p.safetyRateCurrent.value).toBe(GOLDEN_EXPECTED.safetyRateCurrent);
    });

    it('安全率（成長込）= 55.91%', () => {
      expect(p.safetyRateGrowth.value).toBe(GOLDEN_EXPECTED.safetyRateGrowth);
    });

    it('理想購入株価（対現状）= 350円', () => {
      expect(p.idealBuyPriceCurrent.value).toBe(GOLDEN_EXPECTED.idealBuyPriceCurrent);
    });

    it('理想購入株価（対成長）= 283円', () => {
      expect(p.idealBuyPriceGrowth.value).toBe(GOLDEN_EXPECTED.idealBuyPriceGrowth);
    });
  });

  describe('透明性メタデータ（AC2）', () => {
    it('全指標にcalc_versionが含まれる', () => {
      // バージョン文字列は意図的にハードコードする:
      // 計算ロジックを変更して CALC_VERSION を上げると、このテストが落ちて
      // 「ゴールデン値の再検証＋バージョン更新」を強制する仕組み
      const indicators = Object.values(p);
      for (const indicator of indicators) {
        expect(indicator.metadata.calcVersion).toBe('v2.0.0');
      }
    });

    it('全指標にformula文字列が含まれる', () => {
      const indicators = Object.values(p);
      for (const indicator of indicators) {
        expect(indicator.metadata.formula).toBeTruthy();
      }
    });

    it('全指標にrounding情報が含まれる', () => {
      const indicators = Object.values(p);
      for (const indicator of indicators) {
        expect(indicator.metadata.rounding).toBeTruthy();
      }
    });
  });

  describe('パフォーマンス（AC4: NFR1）', () => {
    it('全指標算出が3秒以内に完了する', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        calculateAllIndicators(GOLDEN_FINANCIAL_DATA, GOLDEN_PARAMETERS);
      }
      const elapsed = performance.now() - start;
      // 1000回実行で3秒以内 = 1回あたり3ms以内
      expect(elapsed).toBeLessThan(3000);
    });
  });
});

describe('エッジケース', () => {
  it('財務データが1期のみでも算出できる（成長率はnull）', () => {
    const result = calculateAllIndicators(
      [GOLDEN_FINANCIAL_DATA[0]],
      GOLDEN_PARAMETERS,
    );
    expect(result.period.equityRatio.value).toBe(50);
    expect(result.period.revenueGrowthRate.value).toBeNull();
    expect(result.period.netIncomeGrowthRate.value).toBeNull();
  });

  it('空の財務データでエラーを投げる', () => {
    expect(() => calculateAllIndicators([], GOLDEN_PARAMETERS)).toThrow(
      '財務データが1件以上必要です',
    );
  });

  it('sharesOutstandingがnullの場合、株式系指標はnull', () => {
    const dataWithNullShares = [
      { ...GOLDEN_FINANCIAL_DATA[0], shares_outstanding: null },
    ];
    const result = calculateAllIndicators(dataWithNullShares, GOLDEN_PARAMETERS);
    expect(result.period.eps.value).toBeNull();
    expect(result.period.theoryPrice.value).toBeNull();
    expect(result.period.growthTheoryPrice.value).toBeNull();
  });

  it('currentStockPriceがnullの場合、PER/PBR/安全域はnull', () => {
    const dataWithNullPrice = [
      { ...GOLDEN_FINANCIAL_DATA[0], current_stock_price: null },
    ];
    const result = calculateAllIndicators(dataWithNullPrice, GOLDEN_PARAMETERS);
    expect(result.period.per.value).toBeNull();
    expect(result.period.pbr.value).toBeNull();
    expect(result.period.safetyMarginCurrent.value).toBeNull();
    expect(result.period.safetyRateCurrent.value).toBeNull();
  });

  it('interestBearingDebtは現状理論株価に影響しない', () => {
    const dataWithNullDebt = [
      { ...GOLDEN_FINANCIAL_DATA[0], interest_bearing_debt: null },
    ];
    const result = calculateAllIndicators(dataWithNullDebt, GOLDEN_PARAMETERS);
    expect(result.period.theoryPrice.value).toBe(GOLDEN_EXPECTED.theoryPrice);
  });
});
