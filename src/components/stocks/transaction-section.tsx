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
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
import { TRANSACTION_TYPE_OPTIONS } from '@/lib/schemas/transactions';
import type { TransactionRow } from '@/lib/types/transactions';
import {
  calcPosition,
  calcPositionValuation,
  getTradeSignal,
  idealBuyPriceFromTheory,
} from '@/lib/calc/portfolio';
import { formatCurrency, formatStockPrice, NULL_DISPLAY } from '@/lib/format';

/** 損益値を色付きで表示する（プラス=緑、マイナス=赤） */
function ProfitLoss({ value, percent }: { value: number | null; percent?: number | null }) {
  if (value == null) return <span className="text-muted-foreground">{NULL_DISPLAY}</span>;
  const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-muted-foreground';
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`${color} tabular-nums`}>
      {sign}
      {formatCurrency(value)}
      {percent != null && <span className="ml-1 text-xs">（{sign}{percent}%）</span>}
    </span>
  );
}

/** 売買シグナルのバナー */
function SignalBanner({
  signal,
  reason,
}: {
  signal: 'buy' | 'sell' | 'hold';
  reason: string;
}) {
  const config = {
    buy: { label: '買い時', icon: TrendingUp, cls: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300' },
    sell: { label: '売り時', icon: TrendingDown, cls: 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300' },
    hold: { label: '様子見', icon: Minus, cls: 'border-gray-300 bg-muted text-muted-foreground' },
  }[signal];
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 rounded-lg border-2 p-4 ${config.cls}`} role="status">
      <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">売買シグナル: {config.label}</p>
        <p className="text-sm">{reason}</p>
      </div>
    </div>
  );
}

/** サマリーの1項目 */
function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
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
  const [isPending, startTransition] = useTransition();

  // 取引履歴からポジション・損益・シグナルを算出
  const position = useMemo(() => calcPosition(transactions), [transactions]);
  const valuation = useMemo(
    () => calcPositionValuation(position, currentStockPrice),
    [position, currentStockPrice],
  );
  const idealBuyPrice = idealBuyPriceFromTheory(theoryPrice);
  const signal = getTradeSignal({
    currentPrice: currentStockPrice,
    theoryPrice,
    idealBuyPrice,
    hasPosition: position.quantity > 0,
  });

  const handleSubmit = () => {
    const quantity = Number(form.quantity);
    const unit_price = Number(form.unit_price);
    const fee = Number(form.fee || '0');

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('株数は1以上で入力してください');
      return;
    }
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      toast.error('単価は0以上で入力してください');
      return;
    }

    const payload = {
      stock_id: stockId,
      transaction_type: form.transaction_type,
      trade_date: form.trade_date,
      quantity,
      unit_price,
      fee: Number.isFinite(fee) ? fee : 0,
      memo: form.memo || undefined,
    };

    startTransition(async () => {
      const result = form.id
        ? await updateTransaction({ ...payload, id: form.id })
        : await createTransaction(payload);

      if (result.success) {
        toast.success(form.id ? '取引を更新しました' : '取引を追加しました');
        setForm(emptyForm());
        router.refresh();
      } else {
        toast.error(result.error ?? '保存に失敗しました');
      }
    });
  };

  const handleEdit = (tx: TransactionRow) => {
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
      const result = await deleteTransaction(id, stockId);
      if (result.success) {
        toast.success('取引を削除しました');
        if (form.id === id) setForm(emptyForm());
        router.refresh();
      } else {
        toast.error(result.error ?? '削除に失敗しました');
      }
    });
  };

  return (
    <div className="space-y-6">
      <SignalBanner signal={signal.signal} reason={signal.reason} />

      {/* 保有ポジションのサマリー */}
      <section className="rounded-lg border p-4" aria-labelledby="position-summary-heading">
        <h3 id="position-summary-heading" className="mb-3 text-sm font-semibold">保有ポジション</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryItem label="保有株数">
            {position.quantity > 0 ? `${position.quantity.toLocaleString('ja-JP')}株` : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="平均取得単価">
            {position.averageCost != null ? formatStockPrice(position.averageCost) : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="取得原価（簿価）">
            {position.quantity > 0 ? formatCurrency(position.bookValue) : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="評価額">
            {valuation ? formatCurrency(valuation.marketValue) : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="含み損益">
            <ProfitLoss value={valuation?.unrealizedPL ?? null} percent={valuation?.unrealizedPLPercent} />
          </SummaryItem>
          <SummaryItem label="実現損益（累計）">
            <ProfitLoss value={position.realizedPL} />
          </SummaryItem>
          <SummaryItem label="理論株価">
            {theoryPrice != null ? formatStockPrice(theoryPrice) : NULL_DISPLAY}
          </SummaryItem>
          <SummaryItem label="理想買値（半値）">
            {idealBuyPrice != null ? formatStockPrice(idealBuyPrice) : NULL_DISPLAY}
          </SummaryItem>
        </dl>
      </section>

      {/* 取引の追加・編集フォーム */}
      <section className="rounded-lg border p-4" aria-labelledby="tx-form-heading">
        <h3 id="tx-form-heading" className="mb-3 text-sm font-semibold">
          {form.id ? '取引を編集' : '取引を追加'}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label htmlFor="tx-type" className="text-xs text-muted-foreground">種別</label>
            <Select
              value={form.transaction_type}
              onValueChange={(v) => setForm((f) => ({ ...f, transaction_type: v as 'buy' | 'sell' }))}
            >
              <SelectTrigger id="tx-type" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="tx-date" className="text-xs text-muted-foreground">約定日</label>
            <Input id="tx-date" type="date" value={form.trade_date}
              onChange={(e) => setForm((f) => ({ ...f, trade_date: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <label htmlFor="tx-qty" className="text-xs text-muted-foreground">株数</label>
            <Input id="tx-qty" type="number" inputMode="numeric" value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="mt-1 text-right tabular-nums" placeholder="100" />
          </div>
          <div>
            <label htmlFor="tx-price" className="text-xs text-muted-foreground">単価（円）</label>
            <Input id="tx-price" type="number" inputMode="numeric" value={form.unit_price}
              onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
              className="mt-1 text-right tabular-nums" placeholder="1000" />
          </div>
          <div>
            <label htmlFor="tx-fee" className="text-xs text-muted-foreground">手数料（円）</label>
            <Input id="tx-fee" type="number" inputMode="numeric" value={form.fee}
              onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
              className="mt-1 text-right tabular-nums" placeholder="0" />
          </div>
          <div>
            <label htmlFor="tx-memo" className="text-xs text-muted-foreground">メモ（任意）</label>
            <Input id="tx-memo" type="text" value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              className="mt-1" placeholder="売買理由など" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={handleSubmit} disabled={isPending} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {form.id ? '更新する' : '追加する'}
          </Button>
          {form.id && (
            <Button onClick={() => setForm(emptyForm())} disabled={isPending} size="sm" variant="ghost">
              キャンセル
            </Button>
          )}
        </div>
      </section>

      {/* 取引履歴の一覧 */}
      <section aria-labelledby="tx-list-heading">
        <h3 id="tx-list-heading" className="mb-3 text-sm font-semibold">取引履歴</h3>
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
                  const amount = tx.transaction_type === 'buy' ? gross + tx.fee : gross - tx.fee;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="tabular-nums">{tx.trade_date}</TableCell>
                      <TableCell>
                        <span className={tx.transaction_type === 'buy' ? 'text-green-600' : 'text-red-600'}>
                          {tx.transaction_type === 'buy' ? '買い' : '売り'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{tx.quantity.toLocaleString('ja-JP')}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatStockPrice(tx.unit_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{tx.fee.toLocaleString('ja-JP')}円</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(amount)}</TableCell>
                      <TableCell className="max-w-[12rem] truncate text-muted-foreground" title={tx.memo ?? ''}>
                        {tx.memo || NULL_DISPLAY}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleEdit(tx)} aria-label="編集">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" aria-label="削除">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>この取引を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {tx.trade_date} の{tx.transaction_type === 'buy' ? '買い' : '売り'}（{tx.quantity.toLocaleString('ja-JP')}株）を削除します。この操作は取り消せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(tx.id)}>削除する</AlertDialogAction>
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
