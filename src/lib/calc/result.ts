/**
 * 計算結果と透明性メタデータを一貫した形で組み立てる。
 *
 * 各計算関数が calcVersion や端数処理文言を個別に持つと、数式を追加した際に
 * メタデータだけ更新漏れするため、このモジュールを生成境界として使用する。
 */
import type { CalcMetadata, CalcResult } from '@/lib/types/calc';
import { CALC_VERSION } from '@/lib/types/calc';

/** 画面に表示する端数処理ルールは、表記揺れを防ぐため一箇所で管理する。 */
export const ROUNDING_RULE = {
  twoDecimals: '小数点以下第2位を四捨五入',
  yen: '円未満四捨五入',
  truncateYen: '円未満切捨て',
  inputValue: 'なし（入力値そのまま）',
  none: 'なし',
  integerSubtraction: 'なし（整数同士の減算）',
} as const;

/** calcVersion 以外は、各数式が説明責任を持って指定する。 */
type CalcMetadataDetails = Omit<CalcMetadata, 'calcVersion'>;

/** 現行バージョンを必ず付与して、値と計算根拠を返す。 */
export function createCalcResult<T>(
  value: T | null,
  metadata: CalcMetadataDetails
): CalcResult<T> {
  return {
    value,
    metadata: {
      ...metadata,
      calcVersion: CALC_VERSION,
    },
  };
}

/** 上流の入力不足などで算出できない指標にも、理由を表す数式を残す。 */
export function createUnavailableResult(formula: string): CalcResult<number> {
  return createCalcResult<number>(null, {
    formula,
    inputs: [],
    rounding: ROUNDING_RULE.none,
  });
}
