/**
 * 財務データのスプレッドシート風グリッド入力
 *
 * 横軸=年度、縦軸=財務項目 の表形式で、全期のデータを一覧しながら編集できる。
 * - 年度追加: 任意の年度を指定して追加（過去の年度も可）
 * - 保存: 年度ごとの保存ボタン（変更セルは amber ハイライト）
 * - 削除: 年度ごとの削除ボタン（確認ダイアログ付き）
 * - 列幅: ドラッグでリサイズ可能
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { addEmptyFinancialYear, updateFinancialData, deleteFinancialData } from '@/actions/financial-data';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import { GRID_INDICATORS, type GridValues } from '@/lib/calc/grid-indicators';

/** 表示する財務項目の定義 */
const GRID_ROWS = [
  // P/L
  { key: 'revenue', label: '売上高', required: true, unit: '百万円' },
  { key: 'operating_income', label: '営業利益', required: true, unit: '百万円' },
  { key: 'net_income', label: '当期純利益', required: true, unit: '百万円' },
  { key: 'interest_expense', label: '支払利息', required: false, unit: '百万円' },
  // B/S 資産
  { key: 'cash_and_equivalents', label: '現金及び等価物', required: false, unit: '百万円' },
  { key: 'current_assets', label: '流動資産', required: false, unit: '百万円' },
  { key: 'investments_and_other_assets', label: '投資その他の資産', required: false, unit: '百万円' },
  { key: 'total_assets', label: '総資産', required: true, unit: '百万円' },
  // B/S 負債
  { key: 'current_liabilities', label: '流動負債', required: false, unit: '百万円' },
  { key: 'non_current_liabilities', label: '固定負債', required: false, unit: '百万円' },
  { key: 'interest_bearing_debt', label: '有利子負債', required: false, unit: '百万円' },
  // B/S 純資産
  { key: 'shareholders_equity', label: '株主資本', required: false, unit: '百万円' },
  { key: 'equity', label: '純資産', required: true, unit: '百万円' },
  // CF
  { key: 'operating_cf', label: '営業CF', required: false, unit: '百万円' },
  { key: 'investing_cf', label: '投資CF', required: false, unit: '百万円' },
  // その他
  { key: 'shares_outstanding', label: '発行済株式数', required: false, unit: '株' },
  { key: 'current_stock_price', label: '現在株価', required: false, unit: '円' },
  { key: 'beta', label: 'β値', required: false, unit: '' },
] as const;

type GridRowKey = (typeof GRID_ROWS)[number]['key'];

/** 百万円変換不要なフィールド（株数は株、株価は円、β値は倍率でそのまま表示） */
const NO_MILLION_CONVERSION = new Set<string>([
  'shares_outstanding', 'current_stock_price', 'beta',
]);

/** DB値（円）をグリッド表示値（百万円）に変換する。株数・株価・β値はそのまま */
function toDisplayValue(value: number | null, key: GridRowKey): string {
  if (value == null) return '';
  if (NO_MILLION_CONVERSION.has(key)) return String(value);
  return String(Math.round(value / 1_000_000));
}

/** グリッド表示値（百万円）をDB値（円）に変換する。株数・株価・β値はそのまま */
function fromDisplayValue(displayValue: string, key: GridRowKey): number | null {
  if (displayValue.trim() === '') return null;
  const num = Number(displayValue.replace(/,/g, ''));
  if (isNaN(num)) return null;
  if (NO_MILLION_CONVERSION.has(key)) return num;
  return num * 1_000_000;
}

/** グリッドの1列（1年度）分の全セル値（文字列で保持、Input との双方向バインド用） */
type CellState = Record<GridRowKey, string>;

/** FullFinancialDataRow の DB 値をグリッド表示用の文字列に変換する */
function buildCellState(row: FullFinancialDataRow): CellState {
  const state: Partial<CellState> = {};
  for (const r of GRID_ROWS) {
    state[r.key] = toDisplayValue(row[r.key as keyof FullFinancialDataRow] as number | null, r.key);
  }
  return state as CellState;
}

/** 列ヘッダーのドラッグリサイズ用フック */
function useColumnResize(initialWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX.current;
      setWidth(Math.max(80, startWidth.current + diff));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  return { width, onMouseDown };
}

/** リサイズ可能な列ヘッダー。右端にドラッグハンドル（太め+色付き）を表示 */
function ResizableHead({
  children,
  initialWidth = 120,
  className = '',
}: {
  children: React.ReactNode;
  initialWidth?: number;
  className?: string;
}) {
  const { width, onMouseDown } = useColumnResize(initialWidth);

  return (
    <TableHead className={`relative select-none ${className}`} style={{ width, minWidth: width }}>
      {children}
      {/* ドラッグハンドル: 幅4px、ホバーで色がつく、カーソルが変わる */}
      <div
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-[4px] cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary"
        title="ドラッグで列幅を変更"
        aria-hidden="true"
      />
    </TableHead>
  );
}

export function FinancialDataGrid({
  stockId,
  financialData,
  parameters,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
  parameters: ParametersRow | null;
}) {
  const router = useRouter();
  // 古い年度が左、新しい年度が右（昇順）
  const sorted = [...financialData].sort((a, b) => a.fiscal_year - b.fiscal_year);

  const [cells, setCells] = useState<Record<string, CellState>>(() => {
    const init: Record<string, CellState> = {};
    for (const row of sorted) {
      init[row.id] = buildCellState(row);
    }
    return init;
  });

  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState(() => {
    if (sorted.length === 0) return new Date().getFullYear();
    // 既存年度の最小値 - 1（過去を追加しやすく）か最大値 + 1
    return sorted[0].fiscal_year + 1;
  });

  const handleCellChange = useCallback((rowId: string, key: GridRowKey, value: string) => {
    setCells((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [key]: value },
    }));
    setDirtyIds((prev) => new Set([...prev, rowId]));
  }, []);

  const handleSave = useCallback(async (row: FullFinancialDataRow) => {
    const cellState = cells[row.id];
    if (!cellState) return;

    setSavingId(row.id);

    const data: Record<string, unknown> = {
      stock_id: stockId,
      fiscal_year: row.fiscal_year,
      fiscal_quarter: row.fiscal_quarter,
      consolidation_type: row.consolidation_type,
      input_unit: 'yen',
    };

    for (const r of GRID_ROWS) {
      const dbValue = fromDisplayValue(cellState[r.key], r.key);
      data[r.key] = dbValue != null ? String(dbValue) : '';
    }

    const result = await updateFinancialData(row.id, data as Parameters<typeof updateFinancialData>[1]);
    setSavingId(null);

    if (result.success) {
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      toast.success(`${row.fiscal_year}年度を保存しました`);
    } else {
      toast.error(result.error ?? '保存に失敗しました');
    }
  }, [cells, stockId]);

  const handleAddYear = useCallback(async () => {
    setAddingYear(true);
    const result = await addEmptyFinancialYear(stockId, newYear);
    setAddingYear(false);

    if (result.success) {
      toast.success(`${newYear}年度を追加しました`);
      router.refresh();
    } else {
      toast.error(result.error ?? '追加に失敗しました');
    }
  }, [stockId, newYear, router]);

  const handleDelete = useCallback(async (row: FullFinancialDataRow) => {
    const result = await deleteFinancialData(row.id);
    if (result.success) {
      toast.success(`${row.fiscal_year}年度を削除しました`);
      router.refresh();
    } else {
      toast.error(result.error ?? '削除に失敗しました');
    }
  }, [router]);

  if (sorted.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            財務データがまだ登録されていません
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
              className="w-24"
              aria-label="追加する年度"
            />
            <span className="text-sm text-muted-foreground">年度</span>
            <Button onClick={handleAddYear} disabled={addingYear}>
              <Plus className="mr-2 h-4 w-4" />
              {addingYear ? '追加中...' : '年度を追加する'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          金額は百万円単位（株式数・株価を除く）。列の境界をドラッグで幅調整できます。
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(Number(e.target.value))}
            className="w-24 h-8"
            aria-label="追加する年度"
          />
          <span className="text-sm text-muted-foreground">年度</span>
          <Button onClick={handleAddYear} disabled={addingYear} size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {addingYear ? '追加中...' : '追加'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background w-[130px] min-w-[130px]">
                項目
              </TableHead>
              {sorted.map((row) => (
                <ResizableHead key={row.id} initialWidth={120}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold">{row.fiscal_year}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {row.fiscal_quarter === 'FY' ? '通期' : row.fiscal_quarter}
                    </span>
                  </div>
                </ResizableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {GRID_ROWS.map((gridRow) => (
              <TableRow key={gridRow.key}>
                <TableCell className="sticky left-0 z-10 bg-background text-sm font-medium">
                  <div className="flex items-center gap-1">
                    {gridRow.label}
                    {gridRow.required && <span className="text-destructive">*</span>}
                    <span className="text-xs text-muted-foreground ml-1">({gridRow.unit})</span>
                  </div>
                </TableCell>
                {sorted.map((row) => (
                  <TableCell key={row.id} className="p-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={cells[row.id]?.[gridRow.key] ?? ''}
                      onChange={(e) => handleCellChange(row.id, gridRow.key, e.target.value)}
                      className={`w-full text-right tabular-nums text-sm h-8 grid-cell-input ${
                        dirtyIds.has(row.id) ? 'border-amber-400' : ''
                      }`}
                      placeholder="—"
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {/* 計算指標セクション */}
            <TableRow>
              <TableCell
                colSpan={sorted.length + 1}
                className="sticky left-0 z-10 bg-muted/50 font-semibold text-sm border-l-4 border-l-purple-500 pl-3"
              >
                計算指標（自動算出）
              </TableCell>
            </TableRow>
            {GRID_INDICATORS.map((indicator) => (
              <TableRow key={indicator.key} className="bg-muted/20">
                <TableCell className="sticky left-0 z-10 bg-muted/20 text-sm font-medium">
                  {indicator.label}
                  {indicator.unit && (
                    <span className="text-xs text-muted-foreground ml-1">({indicator.unit})</span>
                  )}
                </TableCell>
                {sorted.map((row, colIdx) => {
                  /** 現在のセル値を GridValues に変換 */
                  const toGridValues = (id: string): GridValues => ({
                    revenue: fromDisplayValue(cells[id]?.revenue ?? '', 'revenue'),
                    operating_income: fromDisplayValue(cells[id]?.operating_income ?? '', 'operating_income'),
                    net_income: fromDisplayValue(cells[id]?.net_income ?? '', 'net_income'),
                    total_assets: fromDisplayValue(cells[id]?.total_assets ?? '', 'total_assets'),
                    equity: fromDisplayValue(cells[id]?.equity ?? '', 'equity'),
                    interest_bearing_debt: fromDisplayValue(cells[id]?.interest_bearing_debt ?? '', 'interest_bearing_debt'),
                    operating_cf: fromDisplayValue(cells[id]?.operating_cf ?? '', 'operating_cf'),
                    investing_cf: fromDisplayValue(cells[id]?.investing_cf ?? '', 'investing_cf'),
                    shares_outstanding: fromDisplayValue(cells[id]?.shares_outstanding ?? '', 'shares_outstanding'),
                    interest_expense: fromDisplayValue(cells[id]?.interest_expense ?? '', 'interest_expense'),
                    current_stock_price: fromDisplayValue(cells[id]?.current_stock_price ?? '', 'current_stock_price'),
                    shareholders_equity: fromDisplayValue(cells[id]?.shareholders_equity ?? '', 'shareholders_equity'),
                  });

                  const currentValues = toGridValues(row.id);
                  /** 前年度のデータ（成長率計算用） */
                  const prevRow = colIdx > 0 ? sorted[colIdx - 1] : null;
                  const prevValues = prevRow ? toGridValues(prevRow.id) : null;

                  const result = indicator.calc(currentValues, parameters, prevValues);

                  return (
                    <TableCell key={row.id} className="text-right tabular-nums text-sm p-2">
                      {result ?? '—'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

            {/* 操作行 */}
            <TableRow>
              <TableCell className="sticky left-0 z-10 bg-background text-sm font-medium">
                操作
              </TableCell>
              {sorted.map((row) => (
                <TableCell key={row.id} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant={dirtyIds.has(row.id) ? 'default' : 'ghost'}
                      onClick={() => handleSave(row)}
                      disabled={savingId === row.id || !dirtyIds.has(row.id)}
                      className="h-7 px-2"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {savingId === row.id ? '保存中' : '保存'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{row.fiscal_year}年度のデータを削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(row)}>削除する</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
