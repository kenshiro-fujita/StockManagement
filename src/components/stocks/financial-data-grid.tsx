/**
 * 財務データのスプレッドシート風グリッド入力
 *
 * 横軸=年度、縦軸=財務項目 の表形式で、全期のデータを一覧しながら編集できる。
 * セルからフォーカスが外れたときに自動保存する。
 */
'use client';

import { useCallback, useState } from 'react';
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
import { createFinancialData, updateFinancialData, deleteFinancialData } from '@/actions/financial-data';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';

/** 表示する財務項目の定義 */
const GRID_ROWS = [
  { key: 'revenue', label: '売上高', required: true, unit: '百万円' },
  { key: 'operating_income', label: '営業利益', required: true, unit: '百万円' },
  { key: 'net_income', label: '当期純利益', required: true, unit: '百万円' },
  { key: 'total_assets', label: '総資産', required: true, unit: '百万円' },
  { key: 'equity', label: '自己資本', required: true, unit: '百万円' },
  { key: 'interest_bearing_debt', label: '有利子負債', required: false, unit: '百万円' },
  { key: 'operating_cf', label: '営業CF', required: false, unit: '百万円' },
  { key: 'investing_cf', label: '投資CF', required: false, unit: '百万円' },
  { key: 'shares_outstanding', label: '発行済株式数', required: false, unit: '株' },
  { key: 'interest_expense', label: '支払利息', required: false, unit: '百万円' },
  { key: 'current_stock_price', label: '現在株価', required: false, unit: '円' },
] as const;

type GridRowKey = (typeof GRID_ROWS)[number]['key'];

/** セルの値を百万円単位の文字列に変換する（表示用） */
function toDisplayValue(value: number | null, key: GridRowKey): string {
  if (value == null) return '';
  if (key === 'shares_outstanding' || key === 'current_stock_price') {
    return String(value);
  }
  // 百万円単位で表示
  return String(Math.round(value / 1_000_000));
}

/** 表示値（百万円）をDB値（円）に変換する */
function fromDisplayValue(displayValue: string, key: GridRowKey): number | null {
  if (displayValue.trim() === '') return null;
  const num = Number(displayValue.replace(/,/g, ''));
  if (isNaN(num)) return null;
  if (key === 'shares_outstanding' || key === 'current_stock_price') {
    return num;
  }
  return num * 1_000_000;
}

type CellState = Record<GridRowKey, string>;

function buildCellState(row: FullFinancialDataRow): CellState {
  const state: Partial<CellState> = {};
  for (const r of GRID_ROWS) {
    state[r.key] = toDisplayValue(
      row[r.key as keyof FullFinancialDataRow] as number | null,
      r.key,
    );
  }
  return state as CellState;
}

export function FinancialDataGrid({
  stockId,
  financialData,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
}) {
  // 年度降順でソート
  const sorted = [...financialData].sort((a, b) => b.fiscal_year - a.fiscal_year);

  // 各年度のセル値をstate管理（編集中の値を保持）
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

  /** セル値の変更 */
  const handleCellChange = useCallback((rowId: string, key: GridRowKey, value: string) => {
    setCells((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [key]: value },
    }));
    setDirtyIds((prev) => new Set([...prev, rowId]));
  }, []);

  /** 1期分を保存 */
  const handleSave = useCallback(async (row: FullFinancialDataRow) => {
    const cellState = cells[row.id];
    if (!cellState) return;

    setSavingId(row.id);

    const data: Record<string, unknown> = {
      stock_id: stockId,
      fiscal_year: row.fiscal_year,
      fiscal_quarter: row.fiscal_quarter,
      consolidation_type: row.consolidation_type,
      input_unit: 'million',
    };

    for (const r of GRID_ROWS) {
      const dbValue = fromDisplayValue(cellState[r.key], r.key);
      // input_unit=million の場合、Server Action 側で百万円→円変換するが、
      // ここでは既に円に変換済みの値を input_unit=yen で渡す
      data[r.key] = dbValue != null ? String(dbValue) : '';
    }
    data['input_unit'] = 'yen';

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

  /** 新しい年度を追加 */
  const handleAddYear = useCallback(async () => {
    const latestYear = sorted.length > 0 ? sorted[0].fiscal_year + 1 : new Date().getFullYear();
    setAddingYear(true);

    const data = {
      stock_id: stockId,
      fiscal_year: latestYear,
      fiscal_quarter: 'FY' as const,
      consolidation_type: 'consolidated' as const,
      revenue: '0',
      operating_income: '0',
      net_income: '0',
      total_assets: '0',
      equity: '0',
      interest_bearing_debt: '',
      operating_cf: '',
      investing_cf: '',
      shares_outstanding: '',
      interest_expense: '',
      current_stock_price: '',
      input_unit: 'yen' as const,
    };

    // createFinancialData はZodで文字列→数値変換するため、unknown 経由で型を合わせる
    const result = await createFinancialData(data as unknown as Parameters<typeof createFinancialData>[0]);
    setAddingYear(false);

    if (result.success) {
      toast.success(`${latestYear}年度を追加しました`);
    } else {
      toast.error(result.error ?? '追加に失敗しました');
    }
  }, [sorted, stockId]);

  if (sorted.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            財務データがまだ登録されていません
          </p>
          <Button onClick={handleAddYear} disabled={addingYear}>
            <Plus className="mr-2 h-4 w-4" />
            {addingYear ? '追加中...' : '最初の年度を追加する'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          金額は百万円単位で入力してください（株式数・株価を除く）
        </p>
        <Button onClick={handleAddYear} disabled={addingYear} size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          {addingYear ? '追加中...' : '年度を追加'}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background min-w-[140px]">項目</TableHead>
              {sorted.map((row) => (
                <TableHead key={row.id} className="text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold">{row.fiscal_year}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {row.fiscal_quarter === 'FY' ? '通期' : row.fiscal_quarter}
                    </span>
                  </div>
                </TableHead>
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
                      className={`w-full text-right tabular-nums text-sm h-8 ${
                        dirtyIds.has(row.id) ? 'border-amber-400' : ''
                      }`}
                      placeholder="—"
                    />
                  </TableCell>
                ))}
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
                          <AlertDialogDescription>
                            この操作は取り消せません。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              const result = await deleteFinancialData(row.id);
                              if (result.success) {
                                toast.success(`${row.fiscal_year}年度を削除しました`);
                              } else {
                                toast.error(result.error ?? '削除に失敗しました');
                              }
                            }}
                          >
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
