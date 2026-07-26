/**
 * 財務グリッド計算指標のテスト
 *
 * grid-indicators は計算エンジンの薄いラッパーであることを保証する:
 * - 0 値（赤字転落・支払利息0等）を「未入力」と誤判定しない（C-12）
 * - 理論株価チェーンがエンジンと同じ値を返す（C-7: 二重実装の解消）
 * - 負の理論株価で安全率が null になる（C-5 がグリッドにも効く）
 */
import { describe, it, expect } from 'vitest';
import { GRID_INDICATORS, type GridValues } from './grid-indicators';
import { calcBusinessValue, calcTheoryPrice } from './theory-price';
import type { ParametersRow } from '@/lib/types/parameters';

const params: ParametersRow = {
  id: 'p1',
  stock_id: 's1',
  discount_rate: 0.08,
  growth_rate: 0.02,
  tax_rate: 0.3,
  cap_multiplier: 10,
  projected_net_income: 500_000_000,
};

/** 全フィールド null のベース値 */
const empty: GridValues = {
  revenue: null,
  operating_income: null,
  net_income: null,
  total_assets: null,
  equity: null,
  interest_bearing_debt: null,
  operating_cf: null,
  investing_cf: null,
  shares_outstanding: null,
  interest_expense: null,
  current_stock_price: null,
  shareholders_equity: null,
  current_assets: null,
  current_liabilities: null,
  investments_and_other_assets: null,
};

function indicator(key: string) {
  const found = GRID_INDICATORS.find((i) => i.key === key);
  if (!found) throw new Error(`indicator not found: ${key}`);
  return found;
}

describe('0 値の扱い（C-12: truthy 判定による誤排除の防止）', () => {
  it('営業利益 0 でも ROIC は 0.0% と算出される', () => {
    const v: GridValues = { ...empty, operating_income: 0, equity: 1_000_000 };
    expect(indicator('roic').calc(v, params)).toBe('0.0%');
  });

  it('当期売上 0 は前年比 -100.0% と算出される', () => {
    const v: GridValues = { ...empty, revenue: 0 };
    const prev: GridValues = { ...empty, revenue: 1_000_000 };
    expect(indicator('revenue_growth').calc(v, params, prev)).toBe('-100.0%');
  });

  it('支払利息 0 は支払利息率 0.0% と算出される', () => {
    const v: GridValues = { ...empty, interest_expense: 0, interest_bearing_debt: 1_000_000 };
    expect(indicator('interest_rate').calc(v, params)).toBe('0.0%');
  });

  it('未入力（null）は従来どおり算出不可', () => {
    expect(indicator('roic').calc(empty, params)).toBeNull();
    expect(indicator('revenue_growth').calc(empty, params, empty)).toBeNull();
  });
});

describe('理論株価チェーン（C-7: エンジンとの一致）', () => {
  const v: GridValues = {
    ...empty,
    operating_income: 100_000_000,
    equity: 500_000_000,
    interest_bearing_debt: 200_000_000,
    shares_outstanding: 1_000_000,
    current_stock_price: 300,
    current_assets: 800_000_000,
    current_liabilities: 300_000_000,
    investments_and_other_assets: 200_000_000,
  };

  it('グリッドの理論株価はエンジンの計算結果と一致する', () => {
    const bv = calcBusinessValue(v.operating_income!, params.cap_multiplier).value!;
    const expected = calcTheoryPrice(bv, 640_000_000, v.shares_outstanding).value!;
    expect(indicator('theory_price').calc(v, params)).toBe(expected.toLocaleString());
  });

  it('株主資本ではなく財産価値の入力を使用する', () => {
    const withSE: GridValues = { ...v, shareholders_equity: 400_000_000 };
    expect(indicator('theory_price').calc(withSE, params)).toBe('1,640');
  });
});

describe('負の理論株価（C-5 のガードがグリッドにも効く）', () => {
  // 有利子負債が過大で理論株価が負になるケース
  const distressed: GridValues = {
    ...empty,
    operating_income: 10_000_000,
    equity: 100_000_000,
    interest_bearing_debt: 1_500_000_000,
    shares_outstanding: 1_000_000,
    current_stock_price: 50,
    current_assets: 100_000_000,
    current_liabilities: 1_000_000_000,
    investments_and_other_assets: 0,
  };

  it('安全率は null（符号反転の誤判定を返さない）', () => {
    expect(indicator('safety_rate').calc(distressed, params)).toBeNull();
  });

  it('安全域は負値として算出される（割高シグナル）', () => {
    const result = indicator('safety_margin').calc(distressed, params);
    expect(result).not.toBeNull();
    expect(result!.startsWith('-')).toBe(true);
  });
});
