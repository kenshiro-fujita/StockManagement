'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { updateStockRating } from '@/actions/roster';

export function StarRating({
  stockId,
  currentRating,
}: {
  stockId: string;
  currentRating: number | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const handleRate = async (rating: number) => {
    if (rating === currentRating) return;
    setIsPending(true);
    const result = await updateStockRating({ stock_id: stockId, rating });
    setIsPending(false);
    if (!result.success) {
      toast.error(result.error ?? '評価の更新に失敗しました');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, star: number) => {
    if (e.key === 'ArrowRight' && star < 5) {
      const next = document.querySelector<HTMLButtonElement>(
        `[data-star="${star + 1}"]`,
      );
      next?.focus();
      next?.click();
    } else if (e.key === 'ArrowLeft' && star > 1) {
      const prev = document.querySelector<HTMLButtonElement>(
        `[data-star="${star - 1}"]`,
      );
      prev?.focus();
      prev?.click();
    }
  };

  const displayRating = hovered ?? currentRating ?? 0;

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role="radiogroup"
      aria-label="銘柄評価"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          data-star={star}
          role="radio"
          aria-checked={currentRating === star}
          aria-label={`★${star}`}
          tabIndex={star === (currentRating ?? 1) ? 0 : -1}
          disabled={isPending}
          onClick={() => handleRate(star)}
          onKeyDown={(e) => handleKeyDown(e, star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className="p-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500 rounded disabled:opacity-50"
        >
          <Star
            className={`h-5 w-5 ${
              star <= displayRating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            }`}
          />
        </button>
      ))}
      {currentRating && (
        <span className="ml-1 text-sm text-muted-foreground">{currentRating}/5</span>
      )}
    </div>
  );
}
