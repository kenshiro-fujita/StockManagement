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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * 1列ぶんのセル状態を計算指標用の GridValues（円換算済み）に変換する。
 * 指標行 × 列ごとに毎回再構築すると無駄なので、呼び出し側で useMemo して使う
 */
function cellsToGridValues(cell: CellState | undefined): GridValues {
  const v = (key: GridRowKey) => fromDisplayValue(cell?.[key] ?? '', key);
  return {
    revenue: v('revenue'),
    operating_income: v('operating_income'),
    net_income: v('net_income'),
    total_assets: v('total_assets'),
    equity: v('equity'),
    interest_bearing_debt: v('interest_bearing_debt'),
    operating_cf: v('operating_cf'),
    investing_cf: v('investing_cf'),
    shares_outstanding: v('shares_outstanding'),
    interest_expense: v('interest_expense'),
    current_stock_price: v('current_stock_price'),
    shareholders_equity: v('shareholders_equity'),
  };
}

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
  // ドラッグ中に登録したリスナーを、コンポーネントのアンマウント時にも確実に外せるよう保持する
  const cleanupRef = useRef<(() => void) | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;

    let frame = 0;
    const onMouseMove = (ev: MouseEvent) => {
      // mousemove は高頻度で発火するため requestAnimationFrame でスロットルする
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const diff = ev.clientX - startX.current;
        setWidth(Math.max(80, startWidth.current + diff));
      });
    };
    const cleanup = () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', cleanup);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', cleanup);
  }, [width]);

  // ドラッグ途中でアンマウントされてもリスナーが残らないようにする
  useEffect(() => () => cleanupRef.current?.(), []);

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

  // dirty 管理はセル単位で行う。
  // 行単位だと「1セル編集して保存」で全フィールドが百万円丸めの表示値から
  // 逆変換されて書き戻され、EDINET 取込した円精度（例: 4,112,318,000円）が
  // 保存のたびに 4,112,000,000円 へ静かに劣化していくため。
  const [dirtyCells, setDirtyCells] = useState<Record<string, Set<GridRowKey>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState(() => {
    if (sorted.length === 0) return new Date().getFullYear();
    // sorted は昇順なので末尾が最新年度。最新+1 をデフォルトにする
    // （先頭+1 だと既存年度と衝突して追加エラーになる）
    return sorted[sorted.length - 1].fiscal_year + 1;
  });

  const isRowDirty = useCallback(
    (rowId: string) => (dirtyCells[rowId]?.size ?? 0) > 0,
    [dirtyCells],
  );

  // 列（年度）ごとの GridValues を cells が変わったときだけ一度構築する。
  // 以前は指標行 × 列ごとに render 内で再構築しており、1セル入力で
  // GRID_INDICATORS × 年度数 ぶんの GridValues 構築が毎回走っていた
  const gridValuesByRow = useMemo(() => {
    const map = new Map<string, GridValues>();
    for (const row of sorted) {
      map.set(row.id, cellsToGridValues(cells[row.id]));
    }
    return map;
  }, [cells, sorted]);

  const handleCellChange = useCallback((rowId: string, key: GridRowKey, value: string) => {
    setCells((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [key]: value },
    }));
    setDirtyCells((prev) => {
      const next = { ...prev };
      next[rowId] = new Set(next[rowId] ?? []);
      next[rowId].add(key);
      return next;
    });
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

    const rowDirty = dirtyCells[row.id] ?? new Set<GridRowKey>();
    for (const r of GRID_ROWS) {
      if (rowDirty.has(r.key)) {
        // ユーザーが編集したセルのみ表示値（百万円）から逆変換する
        const dbValue = fromDisplayValue(cellState[r.key], r.key);
        data[r.key] = dbValue != null ? String(dbValue) : '';
      } else {
        // 未編集セルは DB の生値（円精度）をそのまま書き戻し、丸めによる劣化を防ぐ
        const original = row[r.key as keyof FullFinancialDataRow] as number | null;
        data[r.key] = original != null ? String(original) : '';
      }
    }

    const result = await updateFinancialData(row.id, data as Parameters<typeof updateFinancialData>[1]);
    setSavingId(null);

    if (result.success) {
      setDirtyCells((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      toast.success(`${row.fiscal_year}年度を保存しました`);
    } else {
      toast.error(result.error ?? '保存に失敗しました');
    }
  }, [cells, dirtyCells, stockId]);

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
                        dirtyCells[row.id]?.has(gridRow.key) ? 'border-amber-400' : ''
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
                  const currentValues = gridValuesByRow.get(row.id)!;
                  /** 前年度のデータ（成長率計算用） */
                  const prevRow = colIdx > 0 ? sorted[colIdx - 1] : null;
                  const prevValues = prevRow ? gridValuesByRow.get(prevRow.id) ?? null : null;

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
                      variant={isRowDirty(row.id) ? 'default' : 'ghost'}
                      onClick={() => handleSave(row)}
                      disabled={savingId === row.id || !isRowDirty(row.id)}
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
