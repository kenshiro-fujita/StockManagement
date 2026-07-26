/**
 * 負値・境界値のテスト（v1.1.0 で明文化した丸め仕様と算出不可ガードの検証）
 *
 * 背景: v1.0.0 のゴールデンテストは正値ケースのみで、
 * ①Math.round の負タイ値非対称、②負の理論株価での安全率符号反転、
 * ③Math.floor の負値切捨て（絶対値増加）を検出できなかった。
 * ここでは「割高・減益・債務超過」系の銘柄で起こるケースを固定する。
 */
import { describe, it, expect } from 'vitest';
import {
  roundPercent,
  roundToTwoDecimals,
  roundYen,
  truncateYen,
  resolveEquity,
} from './utils';
import { calcSafetyRate, calcIdealBuyPrice, getValuationLevel } from './safety';
import { calcPER } from './stock-metrics';
import { calculateAllIndicators } from './index';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';

describe('丸め関数の負値対称性', () => {
  it('roundPercent: 正負で対称（絶対値基準の四捨五入）', () => {
    // 0.125 は2進数で正確に表現できるため、浮動小数点誤差なくタイ値を検証できる
    expect(roundPercent(0.125)).toBe(0.13);
    expect(roundPercent(-0.125)).toBe(-0.13); // Math.round 直使用だと -0.12 になる
    expect(roundPercent(3.141)).toBe(3.14);
    expect(roundPercent(-3.141)).toBe(-3.14);
  });

  it('汎用の小数2桁丸めもパーセンテージと同じ負値対称ルールを使う', () => {
    expect(roundToTwoDecimals(2.675)).toBe(2.68);
    expect(roundToTwoDecimals(-2.675)).toBe(-2.68);
  });

  it('roundYen: 0.5 は絶対値基準で切り上げ', () => {
    expect(roundYen(2.5)).toBe(3);
    expect(roundYen(-2.5)).toBe(-3); // Math.round(-2.5) は -2 になってしまう
  });

  it('truncateYen: 負値も0方向へ切捨て（スプレッドシートの ROUNDDOWN と同一）', () => {
    expect(truncateYen(2.978)).toBe(2);
    expect(truncateYen(-2.978)).toBe(-2); // Math.floor だと -3（絶対値が増える）
  });
});

describe('負の理論株価のガード（C-5）', () => {
  it('理論株価が負のとき安全率は null（符号反転で「割安」と誤判定しない）', () => {
    // 旧実装: ((-100 - 50) / -100) × 100 = +150% → cheap と誤判定されていた
    const result = calcSafetyRate(-100, 50);
    expect(result.value).toBeNull();
    expect(getValuationLevel(result.value)).toBeNull();
  });

  it('理論株価が0のとき安全率は null（ゼロ除算防止）', () => {
    expect(calcSafetyRate(0, 50).value).toBeNull();
  });

  it('理論株価が正のときは従来どおり算出される', () => {
    expect(calcSafetyRate(100, 50).value).toBe(50);
  });

  it('理論株価が負のとき理想購入株価は null', () => {
    expect(calcIdealBuyPrice(-100).value).toBeNull();
    expect(calcIdealBuyPrice(0).value).toBeNull();
    expect(calcIdealBuyPrice(471).value).toBe(235); // 正値は半値の切捨て
  });
});

describe('PER は丸め前の生EPSから計算する', () => {
  it('丸め済みEPS経由の系統誤差が出ない', () => {
    // 純利益 333,333,333円 / 1億株 → 生EPS 3.3333… / 株価250円
    // 生EPS基準: 250 ÷ 3.3333… = 75.00
    // 丸め済みEPS(3.33)基準だと 75.08 になってしまう
    const rawEps = 333_333_333 / 100_000_000;
    expect(calcPER(250, rawEps).value).toBe(75);
  });
});

describe('自己資本の解決（C-9: 株主資本優先）', () => {
  it('shareholders_equity があればそれを使う', () => {
    const eq = resolveEquity({ equity: 1000, shareholders_equity: 800 });
    expect(eq.value).toBe(800);
    expect(eq.field).toBe('shareholders_equity');
  });

  it('shareholders_equity が null なら純資産にフォールバック', () => {
    const eq = resolveEquity({ equity: 1000, shareholders_equity: null });
    expect(eq.value).toBe(1000);
    expect(eq.field).toBe('equity');
  });
});

/** 債務超過気味の架空銘柄: 有利子負債が事業価値+資産価値を上回り、理論株価が負になる */
const distressedRow: FullFinancialDataRow = {
  id: 'test-distressed',
  fiscal_year: 2024,
  fiscal_quarter: 'FY',
  consolidation_type: 'consolidated',
  revenue: 1_000_000_000,
  operating_income: 10_000_000, // 営業利益は僅少
  net_income: -50_000_000, // 純損失
  total_assets: 2_000_000_000,
  equity: 100_000_000,
  interest_bearing_debt: 1_500_000_000, // 過大な有利子負債
  operating_cf: null,
  investing_cf: null,
  shares_outstanding: 1_000_000,
  interest_expense: null,
  current_stock_price: 50,
  cash_and_equivalents: null,
  current_assets: null,
  investments_and_other_assets: null,
  current_liabilities: null,
  non_current_liabilities: null,
  shareholders_equity: null,
  beta: null,
  input_unit: 'yen',
};

const testParams: ParametersRow = {
  id: 'test-params',
  stock_id: 'test-stock',
  discount_rate: 0.08,
  growth_rate: 0.02,
  tax_rate: 0.3,
  cap_multiplier: 10,
};

describe('統合: 債務超過的な銘柄（負の理論株価）', () => {
  const results = calculateAllIndicators([distressedRow], testParams);
  const p = results.period;

  it('理論株価は負になる（事業価値+資産価値 < 有利子負債）', () => {
    expect(p.theoryPrice.value).not.toBeNull();
    expect(p.theoryPrice.value!).toBeLessThan(0);
  });

  it('安全率は null（「+150% 割安」のような誤判定を返さない）', () => {
    expect(p.safetyRateCurrent.value).toBeNull();
  });

  it('理想購入株価は null', () => {
    expect(p.idealBuyPriceCurrent.value).toBeNull();
  });

  it('安全域はそのまま算出される（負＝割高シグナルとして意味を持つ）', () => {
    expect(p.safetyMarginCurrent.value).not.toBeNull();
    expect(p.safetyMarginCurrent.value!).toBeLessThan(0);
  });
});
