/**
 * 金額と損益率を一貫した符号・色・桁区切りで表示します。
 *
 * ポートフォリオと銘柄詳細で別々に実装すると、ゼロや null の表示規則が
 * ずれやすいため、損益表示の責務をこのコンポーネントに集約します。
 */
import { formatCurrency, NULL_DISPLAY } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ProfitLoss({
  value,
  percent,
  className,
}: {
  value: number | null;
  percent?: number | null;
  className?: string;
}) {
  if (value == null) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        {NULL_DISPLAY}
      </span>
    );
  }

  const colorClass =
    value > 0
      ? 'text-green-600'
      : value < 0
        ? 'text-red-600'
        : 'text-muted-foreground';
  const sign = value > 0 ? '+' : '';

  return (
    <span className={cn(colorClass, 'tabular-nums', className)}>
      {sign}
      {formatCurrency(value)}
      {percent != null && (
        <span className="ml-1 text-xs">
          （{sign}
          {percent}%）
        </span>
      )}
    </span>
  );
}
