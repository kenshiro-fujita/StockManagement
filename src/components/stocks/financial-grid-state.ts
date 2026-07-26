/**
 * 財務グリッドの表示単位変換とセル状態の調停を担う純粋モジュールです。
 *
 * UIイベントやServer Actionから分離することで、円精度の保持と未保存編集の
 * 保護を副作用なしで検証できるようにします。
 */
import { GRID_INDICATORS, type GridValues } from '@/lib/calc/grid-indicators';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';

/** 入力行と自動計算行を同じ並び順で表示するための定義です。 */
export const GRID_ROWS = [
  { key: 'revenue', label: '売上高', required: true, unit: '百万円' },
  {
    key: 'operating_income',
    label: '営業利益',
    required: true,
    unit: '百万円',
  },
  {
    key: 'net_income',
    label: '当期純利益',
    required: true,
    unit: '百万円',
  },
  {
    key: 'interest_expense',
    label: '支払利息',
    required: false,
    unit: '百万円',
  },
  {
    key: 'cash_and_equivalents',
    label: '現金及び等価物',
    required: false,
    unit: '百万円',
  },
  {
    key: 'current_assets',
    label: '流動資産',
    required: false,
    unit: '百万円',
  },
  {
    key: 'investments_and_other_assets',
    label: '投資その他の資産',
    required: false,
    unit: '百万円',
  },
  {
    key: 'total_assets',
    label: '総資産',
    required: true,
    unit: '百万円',
  },
  {
    key: 'current_liabilities',
    label: '流動負債',
    required: false,
    unit: '百万円',
  },
  {
    key: 'non_current_liabilities',
    label: '固定負債',
    required: false,
    unit: '百万円',
  },
  {
    key: 'interest_bearing_debt',
    label: '有利子負債',
    required: false,
    unit: '百万円',
  },
  {
    key: 'shareholders_equity',
    label: '株主資本',
    required: false,
    unit: '百万円',
  },
  { key: 'equity', label: '純資産', required: true, unit: '百万円' },
  {
    key: 'operating_cf',
    label: '営業CF',
    required: false,
    unit: '百万円',
  },
  {
    key: 'investing_cf',
    label: '投資CF',
    required: false,
    unit: '百万円',
  },
  {
    key: 'shares_outstanding',
    label: '発行済株式数',
    required: false,
    unit: '株',
  },
  {
    key: 'current_stock_price',
    label: '現在株価',
    required: false,
    unit: '円',
  },
  { key: 'beta', label: 'β値', required: false, unit: '' },
] as const;

export { GRID_INDICATORS };
export type GridRowKey = (typeof GRID_ROWS)[number]['key'];
export type CellState = Record<GridRowKey, string>;
export type GridCellMap = Record<string, CellState>;
export type DirtyCellMap = Record<string, Set<GridRowKey>>;

/** 株数・株価・β値は円→百万円変換の対象外です。 */
const RAW_VALUE_FIELDS = new Set<GridRowKey>([
  'shares_outstanding',
  'current_stock_price',
  'beta',
]);

/** DBの円値を入力欄の百万円値へ変換します。 */
export function toDisplayValue(value: number | null, key: GridRowKey): string {
  if (value == null) return '';
  if (RAW_VALUE_FIELDS.has(key)) return String(value);
  return String(Math.round(value / 1_000_000));
}

/** 入力欄の値が、空欄または有限の数値として解釈できるかを判定します。 */
export function isValidDisplayValue(displayValue: string): boolean {
  const normalized = displayValue.trim().replace(/,/g, '');
  return normalized === '' || Number.isFinite(Number(normalized));
}

/** 入力欄の百万円値をDBの円値へ戻します。 */
export function fromDisplayValue(
  displayValue: string,
  key: GridRowKey
): number | null {
  const normalized = displayValue.trim().replace(/,/g, '');
  if (normalized === '') return null;

  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) return null;
  if (RAW_VALUE_FIELDS.has(key)) return numberValue;
  return numberValue * 1_000_000;
}

/** 1年度分の入力セルを自動計算が受け取る円単位の値へ変換します。 */
export function cellsToGridValues(cell: CellState | undefined): GridValues {
  const value = (key: GridRowKey) => fromDisplayValue(cell?.[key] ?? '', key);

  return {
    revenue: value('revenue'),
    operating_income: value('operating_income'),
    net_income: value('net_income'),
    total_assets: value('total_assets'),
    equity: value('equity'),
    interest_bearing_debt: value('interest_bearing_debt'),
    operating_cf: value('operating_cf'),
    investing_cf: value('investing_cf'),
    shares_outstanding: value('shares_outstanding'),
    interest_expense: value('interest_expense'),
    current_stock_price: value('current_stock_price'),
    shareholders_equity: value('shareholders_equity'),
  };
}

/** DB行をグリッドの文字列状態へ変換します。 */
export function buildCellState(row: FullFinancialDataRow): CellState {
  const state: Partial<CellState> = {};

  for (const gridRow of GRID_ROWS) {
    const value = row[gridRow.key as keyof FullFinancialDataRow] as
      | number
      | null;
    state[gridRow.key] = toDisplayValue(value, gridRow.key);
  }

  return state as CellState;
}

/** 初回表示用に、全年度のセル状態をIDで索引化します。 */
export function buildCellMap(rows: FullFinancialDataRow[]): GridCellMap {
  return Object.fromEntries(rows.map((row) => [row.id, buildCellState(row)]));
}

/**
 * 再取得したDB値を反映しつつ、利用者が未保存のセルだけはローカル値を守ります。
 *
 * EDINET取り込みや年度追加の router.refresh 後に全stateを置き換えると、
 * 別年度の入力途中データが消えるためセル単位で調停します。
 */
export function reconcileCellMap(
  current: GridCellMap,
  serverRows: FullFinancialDataRow[],
  dirtyCells: DirtyCellMap
): GridCellMap {
  const reconciled: GridCellMap = {};

  for (const row of serverRows) {
    const serverState = buildCellState(row);
    const currentState = current[row.id];
    const dirtyRow = dirtyCells[row.id];

    if (!currentState || !dirtyRow?.size) {
      reconciled[row.id] = serverState;
      continue;
    }

    const nextState = { ...serverState };
    for (const key of dirtyRow) {
      nextState[key] = currentState[key];
    }
    reconciled[row.id] = nextState;
  }

  return reconciled;
}
