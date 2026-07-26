/**
 * 透明性メタデータの生成境界を固定する。
 *
 * 個別の数式テストに加え、全結果へ calcVersion が自動付与される不変条件を
 * ここで直接検証し、新しい指標の追加時にも同じ契約を再利用できるようにする。
 */
import { describe, expect, it } from 'vitest';
import { CALC_VERSION } from '@/lib/types/calc';
import {
  createCalcResult,
  createUnavailableResult,
  ROUNDING_RULE,
} from './result';

describe('createCalcResult', () => {
  it('値と計算根拠へ現行 calcVersion を付与する', () => {
    const result = createCalcResult(12.34, {
      formula: 'テスト指標 = 入力値',
      inputs: [{ label: '入力値', value: 12.34, field: 'test_value' }],
      rounding: ROUNDING_RULE.twoDecimals,
    });

    expect(result).toEqual({
      value: 12.34,
      metadata: {
        formula: 'テスト指標 = 入力値',
        inputs: [{ label: '入力値', value: 12.34, field: 'test_value' }],
        rounding: '小数点以下第2位を四捨五入',
        calcVersion: CALC_VERSION,
      },
    });
  });
});

describe('createUnavailableResult', () => {
  it('算出不可の理由を残し、空の入力と端数処理なしを返す', () => {
    expect(createUnavailableResult('前期データなし')).toEqual({
      value: null,
      metadata: {
        formula: '前期データなし',
        inputs: [],
        rounding: 'なし',
        calcVersion: CALC_VERSION,
      },
    });
  });
});
