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

  const handleBlur = async () => {
    const numValue = value === '' ? null : parseInt(value, 10);

    if (numValue === currentPriority) return;
    if (numValue !== null && (isNaN(numValue) || numValue < 1)) {
      toast.error('1以上の整数を入力してください');
      setValue(currentPriority?.toString() ?? '');
      return;
    }

    setIsPending(true);
    const result = await updateBuyPriority({
      stock_id: stockId,
      buy_priority: numValue,
    });
    setIsPending(false);

    if (!result.success) {
      toast.error(result.error ?? '優先順の更新に失敗しました');
      setValue(currentPriority?.toString() ?? '');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`priority-${stockId}`} className="text-sm text-muted-foreground shrink-0">
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
