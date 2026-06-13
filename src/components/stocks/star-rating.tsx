'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { updateStockRating } from '@/actions/roster';

/**
 * 5段階の星評価（radiogroup）
 *
 * 設計上の注意:
 * - 矢印キーは「フォーカス移動＋ローカル選択」のみで、サーバー保存は行わない。
 *   以前は移動のたびに click() を発火させており、★5→★1 と動かすだけで
 *   4回の DB 更新が走っていた。確定は Enter/Space またはクリック。
 * - 表示値はローカルの optimistic 値を優先する。props（サーバー値）だけに
 *   依存すると、revalidate が届くまで保存後に古い星数へ巻き戻って見える。
 * - フォーカス制御は ref で行う。document.querySelector('[data-star]') は
 *   同一ページに複数インスタンスがあると他の銘柄の星を操作してしまう。
 */
export function StarRating({
  stockId,
  currentRating,
}: {
  stockId: string;
  currentRating: number | null;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  // 保存済みとみなすローカル値（optimistic）。null は「まだローカル変更なし」
  const [optimistic, setOptimistic] = useState<number | null>(null);
  // キーボードでフォーカス移動中の星（未確定の選択位置）
  const [focusedStar, setFocusedStar] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const effectiveRating = optimistic ?? currentRating;
  const displayRating = hovered ?? focusedStar ?? effectiveRating ?? 0;

  const handleRate = async (rating: number) => {
    if (rating === effectiveRating) return;
    const previous = effectiveRating;

    // 先にローカルへ反映（楽観的更新）。失敗したら戻す
    setOptimistic(rating);
    setIsPending(true);
    const result = await updateStockRating({ stock_id: stockId, rating });
    setIsPending(false);

    if (result.success) {
      // サーバー側の revalidate と合わせて props も最新化する
      router.refresh();
    } else {
      setOptimistic(previous);
      toast.error(result.error ?? '評価の更新に失敗しました');
    }
  };

  /** 矢印キーはフォーカス移動のみ（保存しない）。Home/End にも対応 */
  const handleKeyDown = (e: React.KeyboardEvent, star: number) => {
    let target: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = Math.min(5, star + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = Math.max(1, star - 1);
    else if (e.key === 'Home') target = 1;
    else if (e.key === 'End') target = 5;

    if (target != null) {
      e.preventDefault();
      setFocusedStar(target);
      buttonRefs.current[target - 1]?.focus();
    }
    // Enter/Space はブラウザ標準の click 発火に任せる（= handleRate で確定）
  };

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
          ref={(el) => {
            buttonRefs.current[star - 1] = el;
          }}
          role="radio"
          aria-checked={effectiveRating === star}
          aria-label={`評価 ${star}/5`}
          tabIndex={star === (effectiveRating ?? 1) ? 0 : -1}
          disabled={isPending}
          onClick={() => handleRate(star)}
          onKeyDown={(e) => handleKeyDown(e, star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onBlur={() => setFocusedStar(null)}
          className="p-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500 rounded disabled:opacity-50"
        >
          <Star
            aria-hidden="true"
            className={`h-5 w-5 ${
              star <= displayRating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            }`}
          />
        </button>
      ))}
      {effectiveRating != null && (
        <span className="ml-1 text-sm text-muted-foreground">{effectiveRating}/5</span>
      )}
    </div>
  );
}
