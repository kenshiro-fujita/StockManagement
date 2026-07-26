/**
 * 財務グリッドの単位変換と再取得時の編集保護を検証します。
 */
import { describe, expect, it } from 'vitest';

import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import {
  buildCellMap,
  fromDisplayValue,
  isValidDisplayValue,
  reconcileCellMap,
  toDisplayValue,
} from './financial-grid-state';

function financialRow(
  overrides: Partial<FullFinancialDataRow> = {}
): FullFinancialDataRow {
  return {
    id: 'row-1',
    fiscal_year: 2025,
    fiscal_quarter: 'FY',
    consolidation_type: 'consolidated',
    input_unit: 'yen',
    revenue: 4_112_318_000,
    operating_income: 0,
    net_income: 0,
    total_assets: 0,
    equity: 0,
    interest_bearing_debt: null,
    operating_cf: null,
    investing_cf: null,
    shares_outstanding: null,
    interest_expense: null,
    current_stock_price: null,
    cash_and_equivalents: null,
    current_assets: null,
    investments_and_other_assets: null,
    current_liabilities: null,
    non_current_liabilities: null,
    shareholders_equity: null,
    beta: null,
    ...overrides,
  };
}

describe('financial grid state', () => {
  it('金額だけを百万円表示へ変換し、株価は元の単位を保つ', () => {
    expect(toDisplayValue(4_112_318_000, 'revenue')).toBe('4112');
    expect(toDisplayValue(2_345.5, 'current_stock_price')).toBe('2345.5');
    expect(fromDisplayValue('4,112', 'revenue')).toBe(4_112_000_000);
  });

  it('非数値を無効として扱い、DBクリア値へ誤変換しない', () => {
    expect(isValidDisplayValue('1,234')).toBe(true);
    expect(isValidDisplayValue('12abc')).toBe(false);
    expect(isValidDisplayValue('Infinity')).toBe(false);
  });

  it('再取得時に未保存セルだけを保持して他のセルはサーバー値へ追従する', () => {
    const initialRow = financialRow({ operating_income: 100_000_000 });
    const current = buildCellMap([initialRow]);
    const currentRow = current[initialRow.id];
    if (!currentRow) {
      throw new Error('初期財務データからセル状態を生成できませんでした');
    }
    currentRow.revenue = '5000';

    const refreshedRow = financialRow({
      revenue: 4_500_000_000,
      operating_income: 200_000_000,
    });
    const reconciled = reconcileCellMap(current, [refreshedRow], {
      [initialRow.id]: new Set(['revenue']),
    });

    expect(reconciled[initialRow.id]?.revenue).toBe('5000');
    expect(reconciled[initialRow.id]?.operating_income).toBe('200');
  });
});
