/**
 * 売買取引・損益セクション（銘柄詳細の「取引・損益」タブ）
 *
 * - 売買シグナル（安く買い・高く売る）のバナー
 * - 保有ポジションのサマリー（保有株数・平均取得単価・評価額・含み損益・実現損益）
 * - 取引履歴の一覧（追加・編集・削除）
 *
 * 計算は lib/calc/portfolio の純粋関数に委譲し、ここは入力と表示に専念する。
 */
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/actions/transactions';
import {
  createTransactionSchema,
  TRANSACTION_TYPE_OPTIONS,
} from '@/lib/schemas/transactions';
import type { TransactionRow } from '@/lib/types/transactions';
import {
  calcPosition,
  calcPositionValuation,
  getTradeSignal,
  idealBuyPriceFromTheory,
} from '@/lib/calc/portfolio';
import { formatCurrency, formatStockPrice, NULL_DISPLAY } from '@/lib/format';
import { ProfitLoss } from '@/components/stocks/profit-loss';

/** 売買シグナルのバナー */
function SignalBanner({
  signal,
  reason,
}: {
  signal: 'buy' | 'sell' | 'hold';
  reason: string;
}) {
  const config = {
    buy: {
      label: '買い時',
      icon: TrendingUp,
      cls: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300',
    },
    sell: {
      label: '売り時',
      icon: TrendingDown,
      cls: 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300',
    },
    hold: {
      label: '様子見',
      icon: Minus,
      cls: 'border-gray-300 bg-muted text-muted-foreground',
    },
  }[signal];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border-2 p-4 ${config.cls}`}
      role="status"
    >
      <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">売買シグナル: {config.label}</p>
        <p className="text-sm">{reason}</p>
      </div>
    </div>
  );
}

/** サマリーの1項目 */
function SummaryItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

type FormState = {
  id: string | null; // null = 新規, 値あり = 編集
  transaction_type: 'buy' | 'sell';
  trade_date: string;
  quantity: string;
  unit_price: string;
  fee: string;
  memo: string;
};

type TransactionField = Exclude<keyof FormState, 'id' | 'transaction_type'>;
type FormErrors = Partial<Record<TransactionField, string>>;

function emptyForm(): FormState {
  return {
    id: null,
    transaction_type: 'buy',
    trade_date: new Date().toLocaleDateString('sv-SE'),
    quantity: '',
    unit_price: '',
    fee: '0',
    memo: '',
  };
}

/** フィールド固有のエラーを入力欄と関連付けて読み上げます。 */
function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) return null;

  return (
    <p id={id} className="mt-1 text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}

export function TransactionSection({
  stockId,
  transactions,
  theoryPrice,
  currentStockPrice,
}: {
  stockId: string;
  transactions: TransactionRow[];
  theoryPrice: number | null;
  currentStockPrice: number | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();

  // 取引履歴からポジション・損益・シグナルを算出
  const position = useMemo(() => calcPosition(transactions), [transactions]);
  const valuation = useMemo(
    () => calcPositionValuation(position, currentStockPrice),
    [position, currentStockPrice]
  );
  const idealBuyPrice = idealBuyPriceFromTheory(theoryPrice);
  const signal = getTradeSignal({
    currentPrice: currentStockPrice,
    theoryPrice,
    idealBuyPrice,
    hasPosition: position.quantity > 0,
  });

  /** 編集時に該当フィールドのエラーだけを消し、他の検証結果は保持します。 */
  const updateFormField = <Key extends Exclude<keyof FormState, 'id'>>(
    key: Key,
    value: FormState[Key]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key !== 'transaction_type') {
      const errorKey = key as TransactionField;
      setFormErrors((current) => {
        if (!current[errorKey]) return current;
        const next = { ...current };
        delete next[errorKey];
        return next;
      });
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const candidate = {
      stock_id: stockId,
      transaction_type: form.transaction_type,
      trade_date: form.trade_date,
      quantity: form.quantity.trim() ? Number(form.quantity) : Number.NaN,
      unit_price: form.unit_price.trim() ? Number(form.unit_price) : Number.NaN,
      fee: form.fee.trim() ? Number(form.fee) : 0,
      memo: form.memo || undefined,
    };
    const parsed = createTransactionSchema.safeParse(candidate);

    if (!parsed.success) {
      const errors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          typeof field === 'string' &&
          field !== 'stock_id' &&
          field !== 'transaction_type' &&
          field !== 'id' &&
          !(field in errors)
        ) {
          errors[field as TransactionField] = issue.message;
        }
      }
      setFormErrors(errors);
      toast.error(
        parsed.error.issues[0]?.message ?? '入力内容をご確認ください'
      );
      return;
    }

    startTransition(async () => {
      try {
        const result = form.id
          ? await updateTransaction({ ...parsed.data, id: form.id })
          : await createTransaction(parsed.data);

        if (result.success) {
          toast.success(form.id ? '取引を更新しました' : '取引を追加しました');
          setForm(emptyForm());
          setFormErrors({});
          router.refresh();
        } else {
          toast.error(result.error ?? '保存に失敗しました');
        }
      } catch {
        toast.error('取引の保存中にエラーが発生しました');
      }
    });
  };

  const handleEdit = (tx: TransactionRow) => {
    setFormErrors({});
    setForm({
      id: tx.id,
      transaction_type: tx.transaction_type,
      trade_date: tx.trade_date,
      quantity: String(tx.quantity),
      unit_price: String(tx.unit_price),
      fee: String(tx.fee),
      memo: tx.memo ?? '',
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const result = await deleteTransaction(id, stockId);
        if (result.success) {
          toast.success('取引を削除しました');
          if (form.id === id) {
            setForm(emptyForm());
            setFormErrors({});
          }
          router.refresh();
        } else {
          toast.error(result.error ?? '削除に失敗しました');
        }
      } catch {
        toast.error('取引の削除中にエラーが発生しました');
      }
    });
  };

  return (
    <div className="space-y-6">
      <SignalBanner signal={signal.signal} reason={signal.reason} />

      {/* 保有ポジションのサマリー */}
      <section
        className="rounded-lg border p-4"
        aria-labelledby="position-summary-heading"
      >
        <h3
          id="position-summary-heading"
          className="mb-3 text-sm font-semibold"
        >
          保有ポジション
        </h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryItem label="保有株数">
            {position.quantity > 0
              ? `${position.quantity.toLocaleString('ja-JP')}株`
              : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="平均取得単価">
            {position.averageCost != null
              ? formatStockPrice(position.averageCost)
              : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="取得原価（簿価）">
            {position.quantity > 0
              ? formatCurrency(position.bookValue)
              : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="評価額">
            {valuation ? formatCurrency(valuation.marketValue) : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="含み損益">
            <ProfitLoss
              value={valuation?.unrealizedPL ?? null}
              percent={valuation?.unrealizedPLPercent}
            />
          </SummaryItem>
          <SummaryItem label="実現損益（累計）">
            <ProfitLoss value={position.realizedPL} />
          </SummaryItem>
          <SummaryItem label="理論株価">
            {theoryPrice != null ? formatStockPrice(theoryPrice) : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="理想買値（半値）">
            {idealBuyPrice != null
              ? formatStockPrice(idealBuyPrice)
              : NULL_DISPLAY}
          </SummaryItem>
        </dl>
      </section>

      {/* 取引の追加・編集フォーム */}
      <section
        className="rounded-lg border p-4"
        aria-labelledby="tx-form-heading"
      >
        <form onSubmit={handleSubmit} noValidate aria-busy={isPending}>
          <h3 id="tx-form-heading" className="mb-3 text-sm font-semibold">
            {form.id ? '取引を編集' : '取引を追加'}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label
                htmlFor="tx-type"
                className="text-xs text-muted-foreground"
              >
                種別
              </label>
              <Select
                value={form.transaction_type}
                onValueChange={(value) =>
                  updateFormField(
                    'transaction_type',
                    value as FormState['transaction_type']
                  )
                }
              >
                <SelectTrigger id="tx-type" className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                htmlFor="tx-date"
                className="text-xs text-muted-foreground"
              >
                約定日
              </label>
              <Input
                id="tx-date"
                type="date"
                required
                value={form.trade_date}
                onChange={(event) =>
                  updateFormField('trade_date', event.target.value)
                }
                className="mt-1"
                aria-invalid={!!formErrors.trade_date}
                aria-describedby={
                  formErrors.trade_date ? 'tx-date-error' : undefined
                }
              />
              <FieldError id="tx-date-error" message={formErrors.trade_date} />
            </div>
            <div>
              <label htmlFor="tx-qty" className="text-xs text-muted-foreground">
                株数
              </label>
              <Input
                id="tx-qty"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                required
                value={form.quantity}
                onChange={(event) =>
                  updateFormField('quantity', event.target.value)
                }
                className="mt-1 text-right tabular-nums"
                placeholder="100"
                aria-invalid={!!formErrors.quantity}
                aria-describedby={
                  formErrors.quantity ? 'tx-qty-error' : undefined
                }
              />
              <FieldError id="tx-qty-error" message={formErrors.quantity} />
            </div>
            <div>
              <label
                htmlFor="tx-price"
                className="text-xs text-muted-foreground"
              >
                単価（円）
              </label>
              <Input
                id="tx-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                required
                value={form.unit_price}
                onChange={(event) =>
                  updateFormField('unit_price', event.target.value)
                }
                className="mt-1 text-right tabular-nums"
                placeholder="1000"
                aria-invalid={!!formErrors.unit_price}
                aria-describedby={
                  formErrors.unit_price ? 'tx-price-error' : undefined
                }
              />
              <FieldError id="tx-price-error" message={formErrors.unit_price} />
            </div>
            <div>
              <label htmlFor="tx-fee" className="text-xs text-muted-foreground">
                手数料（円）
              </label>
              <Input
                id="tx-fee"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.fee}
                onChange={(event) => updateFormField('fee', event.target.value)}
                className="mt-1 text-right tabular-nums"
                placeholder="0"
                aria-invalid={!!formErrors.fee}
                aria-describedby={formErrors.fee ? 'tx-fee-error' : undefined}
              />
              <FieldError id="tx-fee-error" message={formErrors.fee} />
            </div>
            <div>
              <label
                htmlFor="tx-memo"
                className="text-xs text-muted-foreground"
              >
                メモ（任意）
              </label>
              <Input
                id="tx-memo"
                type="text"
                maxLength={500}
                value={form.memo}
                onChange={(event) =>
                  updateFormField('memo', event.target.value)
                }
                className="mt-1"
                placeholder="売買理由など"
                aria-invalid={!!formErrors.memo}
                aria-describedby={formErrors.memo ? 'tx-memo-error' : undefined}
              />
              <FieldError id="tx-memo-error" message={formErrors.memo} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={isPending} size="sm">
              {form.id ? (
                <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              )}
              {form.id ? '更新する' : '追加する'}
            </Button>
            {form.id && (
              <Button
                type="button"
                onClick={() => {
                  setForm(emptyForm());
                  setFormErrors({});
                }}
                disabled={isPending}
                size="sm"
                variant="ghost"
              >
                キャンセル
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* 取引履歴の一覧 */}
      <section aria-labelledby="tx-list-heading">
        <h3 id="tx-list-heading" className="mb-3 text-sm font-semibold">
          取引履歴
        </h3>
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            取引履歴がまだありません。上のフォームから売買を記録できます。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>約定日</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead className="text-right">株数</TableHead>
                  <TableHead className="text-right">単価</TableHead>
                  <TableHead className="text-right">手数料</TableHead>
                  <TableHead className="text-right">約定金額</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  // 約定金額: 買いは支払額(+手数料)、売りは受取額(-手数料)
                  const gross = tx.quantity * tx.unit_price;
                  const amount =
                    tx.transaction_type === 'buy'
                      ? gross + tx.fee
                      : gross - tx.fee;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="tabular-nums">
                        {tx.trade_date}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            tx.transaction_type === 'buy'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {tx.transaction_type === 'buy' ? '買い' : '売り'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tx.quantity.toLocaleString('ja-JP')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatStockPrice(tx.unit_price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tx.fee.toLocaleString('ja-JP')}円
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(amount)}
                      </TableCell>
                      <TableCell
                        className="max-w-[12rem] truncate text-muted-foreground"
                        title={tx.memo ?? ''}
                      >
                        {tx.memo || NULL_DISPLAY}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleEdit(tx)}
                            aria-label="編集"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                aria-label="削除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  この取引を削除しますか？
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {tx.trade_date} の
                                  {tx.transaction_type === 'buy'
                                    ? '買い'
                                    : '売り'}
                                  （{tx.quantity.toLocaleString('ja-JP')}
                                  株）を削除します。この操作は取り消せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  キャンセル
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(tx.id)}
                                >
                                  削除する
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
