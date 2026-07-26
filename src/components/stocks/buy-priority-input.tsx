'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { updateBuyPriority } from '@/actions/roster';

export function BuyPriorityInput({
  stockId,
  currentPriority,
}: {
  stockId: string;
  currentPriority: number | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [value, setValue] = useState(currentPriority?.toString() ?? '');
  // 「保存済みの値」はローカルで追跡する。props の currentPriority と比較すると、
  // revalidate 前の古い props に対して「2に変更→1に戻す」が no-op 扱いになり、
  // DB は 2 のまま UI は 1 という乖離が起きる
  const [savedPriority, setSavedPriority] = useState(currentPriority);

  const handleBlur = async () => {
    const numValue = value === '' ? null : parseInt(value, 10);

    if (numValue === savedPriority) return;
    if (numValue !== null && (isNaN(numValue) || numValue < 1)) {
      toast.error('1以上の整数を入力してください');
      setValue(savedPriority?.toString() ?? '');
      return;
    }

    setIsPending(true);
    try {
      const result = await updateBuyPriority({
        stock_id: stockId,
        buy_priority: numValue,
      });
      if (result.success) {
        setSavedPriority(numValue);
        return;
      }

      toast.error(result.error ?? '優先順の更新に失敗しました');
      setValue(savedPriority?.toString() ?? '');
    } catch {
      toast.error('優先順の更新に失敗しました');
      setValue(savedPriority?.toString() ?? '');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={`priority-${stockId}`}
        className="shrink-0 text-sm text-muted-foreground"
      >
        購入優先順
      </label>
      <Input
        id={`priority-${stockId}`}
        type="number"
        min={1}
        step={1}
        placeholder="—"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={isPending}
        className="w-20 tabular-nums"
        aria-label="購入優先順（1が最優先）"
      />
    </div>
  );
}
