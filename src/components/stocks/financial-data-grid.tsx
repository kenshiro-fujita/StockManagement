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
import {
  addEmptyFinancialYear,
  updateFinancialData,
  deleteFinancialData,
} from '@/actions/financial-data';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { GridValues } from '@/lib/calc/grid-indicators';
import {
  buildCellMap,
  cellsToGridValues,
  fromDisplayValue,
  GRID_INDICATORS,
  GRID_ROWS,
  isValidDisplayValue,
  reconcileCellMap,
  type DirtyCellMap,
  type GridCellMap,
  type GridRowKey,
} from '@/components/stocks/financial-grid-state';

/** 列ヘッダーのドラッグリサイズ用フック */
function useColumnResize(initialWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const startX = useRef(0);
  const startWidth = useRef(0);
  // ドラッグ中に登録したリスナーを、コンポーネントのアンマウント時にも確実に外せるよう保持する
  const cleanupRef = useRef<(() => void) | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [width]
  );

  /** キーボード操作では一定量ずつ変更し、マウスと同じ最小幅を守ります。 */
  const resizeBy = useCallback((delta: number) => {
    setWidth((currentWidth) => Math.max(80, currentWidth + delta));
  }, []);

  // ドラッグ途中でアンマウントされてもリスナーが残らないようにする
  useEffect(() => () => cleanupRef.current?.(), []);

  return { width, onMouseDown, resizeBy };
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
  const { width, onMouseDown, resizeBy } = useColumnResize(initialWidth);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      resizeBy(-10);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      resizeBy(10);
    }
  };

  return (
    <TableHead
      className={`relative select-none ${className}`}
      style={{ width, minWidth: width }}
    >
      {children}
      <button
        type="button"
        onMouseDown={onMouseDown}
        onKeyDown={handleKeyDown}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-border transition-colors hover:bg-primary/50 focus-visible:bg-primary focus-visible:outline-none active:bg-primary"
        title="ドラッグで列幅を変更"
        aria-label="列幅を変更。左右の矢印キーでも調整できます"
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
  // 並べ替え結果を固定し、1セル入力ごとの全年度再ソートを避けます。
  const sorted = useMemo(
    () => [...financialData].sort((a, b) => a.fiscal_year - b.fiscal_year),
    [financialData]
  );
  const [cells, setCells] = useState<GridCellMap>(() => buildCellMap(sorted));

  // dirty 管理はセル単位で行う。
  // 行単位だと「1セル編集して保存」で全フィールドが百万円丸めの表示値から
  // 逆変換されて書き戻され、EDINET 取込した円精度（例: 4,112,318,000円）が
  // 保存のたびに 4,112,000,000円 へ静かに劣化していくため。
  const [dirtyCells, setDirtyCells] = useState<DirtyCellMap>({});
  const [baselineRows, setBaselineRows] = useState<
    Record<string, FullFinancialDataRow>
  >(() => Object.fromEntries(sorted.map((row) => [row.id, row])));
  const [previousFinancialData, setPreviousFinancialData] =
    useState(financialData);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState(() => {
    if (sorted.length === 0) return new Date().getFullYear();
    // sorted は昇順なので末尾が最新年度。最新+1 をデフォルトにする
    // （先頭+1 だと既存年度と衝突して追加エラーになる）
    const latestRow = sorted.at(-1);
    return latestRow ? latestRow.fiscal_year + 1 : new Date().getFullYear();
  });

  if (previousFinancialData !== financialData) {
    // 条件付きのrender-time調停により、Effect由来の余分な描画を発生させません。
    setPreviousFinancialData(financialData);
    setCells((current) => reconcileCellMap(current, sorted, dirtyCells));
    setBaselineRows(Object.fromEntries(sorted.map((row) => [row.id, row])));
  }

  const isRowDirty = useCallback(
    (rowId: string) => (dirtyCells[rowId]?.size ?? 0) > 0,
    [dirtyCells]
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

  const handleCellChange = useCallback(
    (rowId: string, key: GridRowKey, value: string) => {
      setCells((prev) => {
        const currentRow = prev[rowId];
        if (!currentRow) return prev;

        return {
          ...prev,
          [rowId]: { ...currentRow, [key]: value },
        };
      });
      setDirtyCells((prev) => {
        const next = { ...prev };
        const rowDirtyCells = new Set(next[rowId] ?? []);
        rowDirtyCells.add(key);
        next[rowId] = rowDirtyCells;
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(
    async (row: FullFinancialDataRow) => {
      const cellState = cells[row.id];
      if (!cellState) return;

      const rowDirty = dirtyCells[row.id] ?? new Set<GridRowKey>();
      const invalidField = GRID_ROWS.find(
        (gridRow) =>
          rowDirty.has(gridRow.key) &&
          !isValidDisplayValue(cellState[gridRow.key])
      );

      if (invalidField) {
        toast.error(`${invalidField.label}は数値で入力してください`);
        return;
      }

      const baselineRow = baselineRows[row.id] ?? row;
      const data: Record<string, unknown> = {
        stock_id: stockId,
        fiscal_year: row.fiscal_year,
        fiscal_quarter: row.fiscal_quarter,
        consolidation_type: row.consolidation_type,
        input_unit: 'yen',
      };
      const persistedDirtyValues: Partial<Record<GridRowKey, number | null>> =
        {};

      for (const r of GRID_ROWS) {
        if (rowDirty.has(r.key)) {
          // ユーザーが編集したセルのみ表示値（百万円）から逆変換する
          const dbValue = fromDisplayValue(cellState[r.key], r.key);
          data[r.key] = dbValue != null ? String(dbValue) : '';
          persistedDirtyValues[r.key] = dbValue;
        } else {
          // 未編集セルは DB の生値（円精度）をそのまま書き戻し、丸めによる劣化を防ぐ
          const original = baselineRow[r.key as keyof FullFinancialDataRow] as
            | number
            | null;
          data[r.key] = original != null ? String(original) : '';
        }
      }

      setSavingId(row.id);

      try {
        const result = await updateFinancialData(
          row.id,
          data as Parameters<typeof updateFinancialData>[1]
        );

        if (result.success) {
          setBaselineRows((currentRows) => ({
            ...currentRows,
            [row.id]: {
              ...(currentRows[row.id] ?? row),
              ...persistedDirtyValues,
            } as FullFinancialDataRow,
          }));
          setDirtyCells((prev) => {
            const next = { ...prev };
            delete next[row.id];
            return next;
          });
          toast.success(`${row.fiscal_year}年度を保存しました`);
          router.refresh();
        } else {
          toast.error(result.error ?? '保存に失敗しました');
        }
      } catch {
        toast.error('保存中にエラーが発生しました');
      } finally {
        setSavingId(null);
      }
    },
    [baselineRows, cells, dirtyCells, router, stockId]
  );

  const handleAddYear = useCallback(async () => {
    if (!Number.isInteger(newYear)) {
      toast.error('年度は整数で入力してください');
      return;
    }

    setAddingYear(true);
    try {
      const result = await addEmptyFinancialYear(stockId, newYear);
      if (result.success) {
        toast.success(`${newYear}年度を追加しました`);
        router.refresh();
      } else {
        toast.error(result.error ?? '追加に失敗しました');
      }
    } catch {
      toast.error('年度の追加中にエラーが発生しました');
    } finally {
      setAddingYear(false);
    }
  }, [stockId, newYear, router]);

  const handleDelete = useCallback(
    async (row: FullFinancialDataRow) => {
      try {
        const result = await deleteFinancialData(row.id);
        if (result.success) {
          toast.success(`${row.fiscal_year}年度を削除しました`);
          router.refresh();
        } else {
          toast.error(result.error ?? '削除に失敗しました');
        }
      } catch {
        toast.error('削除中にエラーが発生しました');
      }
    },
    [router]
  );

  if (sorted.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="mb-4 text-muted-foreground">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          金額は百万円単位（株式数・株価を除く）。列の境界をドラッグで幅調整できます。
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(Number(e.target.value))}
            className="h-8 w-24"
            aria-label="追加する年度"
          />
          <span className="text-sm text-muted-foreground">年度</span>
          <Button
            onClick={handleAddYear}
            disabled={addingYear}
            size="sm"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            {addingYear ? '追加中...' : '追加'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 w-[130px] min-w-[130px] bg-background">
                項目
              </TableHead>
              {sorted.map((row) => (
                <ResizableHead key={row.id} initialWidth={120}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold">{row.fiscal_year}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {row.fiscal_quarter === 'FY'
                        ? '通期'
                        : row.fiscal_quarter}
                    </span>
                  </div>
                </ResizableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {GRID_ROWS.map((gridRow) => (
              <TableRow key={gridRow.key}>
                {/* 項目名は行ヘッダー（th scope="row"）にして、スクリーンリーダーが
                    各セルを「年度 × 項目名」で読み上げられるようにする */}
                <TableHead
                  scope="row"
                  className="sticky left-0 z-10 bg-background text-sm font-medium text-foreground"
                >
                  <div className="flex items-center gap-1">
                    {gridRow.label}
                    {gridRow.required && (
                      <span className="text-destructive">*</span>
                    )}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({gridRow.unit})
                    </span>
                  </div>
                </TableHead>
                {sorted.map((row) => {
                  const cellValue = cells[row.id]?.[gridRow.key] ?? '';
                  const isDirty = dirtyCells[row.id]?.has(gridRow.key) ?? false;
                  const isInvalid = isDirty && !isValidDisplayValue(cellValue);

                  return (
                    <TableCell key={row.id} className="p-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        // 無名の入力欄が並ぶとSRで何の値か分からないため、年度×項目名を付与
                        aria-label={`${row.fiscal_year}年度 ${gridRow.label}（${gridRow.unit || '数値'}）`}
                        aria-invalid={isInvalid}
                        value={cellValue}
                        onChange={(e) =>
                          handleCellChange(row.id, gridRow.key, e.target.value)
                        }
                        className={`grid-cell-input h-8 w-full text-right text-sm tabular-nums ${
                          isDirty ? 'border-amber-400' : ''
                        }`}
                        placeholder="—"
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

            {/* 計算指標セクション */}
            <TableRow>
              <TableCell
                colSpan={sorted.length + 1}
                className="sticky left-0 z-10 border-l-4 border-l-purple-500 bg-muted/50 pl-3 text-sm font-semibold"
              >
                計算指標（自動算出）
              </TableCell>
            </TableRow>
            {GRID_INDICATORS.map((indicator) => (
              <TableRow key={indicator.key} className="bg-muted/20">
                <TableCell className="sticky left-0 z-10 bg-muted/20 text-sm font-medium">
                  {indicator.label}
                  {indicator.unit && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({indicator.unit})
                    </span>
                  )}
                </TableCell>
                {sorted.map((row, colIdx) => {
                  const currentValues = gridValuesByRow.get(row.id)!;
                  /** 前年度のデータ（成長率計算用） */
                  const prevRow = colIdx > 0 ? sorted[colIdx - 1] : null;
                  const prevValues = prevRow
                    ? (gridValuesByRow.get(prevRow.id) ?? null)
                    : null;

                  const result = indicator.calc(
                    currentValues,
                    parameters,
                    prevValues
                  );

                  return (
                    <TableCell
                      key={row.id}
                      className="p-2 text-right text-sm tabular-nums"
                    >
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
                      disabled={savingId !== null || !isRowDirty(row.id)}
                      className="h-7 px-2"
                    >
                      <Save className="mr-1 h-3 w-3" />
                      {savingId === row.id ? '保存中' : '保存'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          aria-label={`${row.fiscal_year}年度の財務データを削除`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {row.fiscal_year}年度のデータを削除しますか？
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            この操作は取り消せません。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(row)}>
                            削除する
                          </AlertDialogAction>
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
