import Link from 'next/link';
import { X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatCurrency,
  formatStockPrice,
  formatPercent,
  formatPercentUnsigned,
  formatMultiple,
  formatPerShare,
  NULL_DISPLAY,
} from '@/lib/format';
import type { IndicatorResults } from '@/lib/types/calc';
import type { RosterCategory } from '@/lib/types/roster';
import {
  ROSTER_CATEGORY_LABELS,
  ROSTER_BADGE_STYLES,
} from '@/lib/schemas/roster';
import {
  COMPARISON_CATEGORIES,
  findBestIndex,
  getComparisonValues,
  type ComparisonIndicator,
} from '@/lib/calc/comparison';

type ComparisonStock = {
  id: string;
  stock_code: string;
  company_name: string;
  rosterCategory: RosterCategory | null;
  rating: number | null;
  buyPriority: number | null;
  results: IndicatorResults | null;
};

const FORMAT_FNS: Record<ComparisonIndicator['format'], (v: number | null) => string> = {
  stockPrice: formatStockPrice,
  percent: formatPercent,
  percentUnsigned: formatPercentUnsigned,
  currency: formatCurrency,
  multiple: formatMultiple,
  perShare: formatPerShare,
};

export function ComparisonTable({
  stocks,
  onRemove,
}: {
  stocks: ComparisonStock[];
  onRemove?: (id: string) => void;
}) {
  const allResults = stocks.map((s) => s.results);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background min-w-[160px]">指標</TableHead>
            {stocks.map((stock) => (
              <TableHead key={stock.id} className="min-w-[140px] text-center">
                <div className="flex flex-col items-center gap-1">
                  <Link
                    href={`/stocks/${stock.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {stock.stock_code}
                  </Link>
                  <span className="text-xs font-normal text-muted-foreground truncate max-w-[120px]">
                    {stock.company_name}
                  </span>
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => onRemove(stock.id)}
                      aria-label={`${stock.company_name} を比較から削除`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* ロースター行 */}
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-background font-medium text-muted-foreground text-sm">
              ロースター
            </TableCell>
            {stocks.map((stock) => (
              <TableCell key={stock.id} className="text-center">
                {stock.rosterCategory ? (
                  <Badge variant="outline" className={ROSTER_BADGE_STYLES[stock.rosterCategory].className}>
                    {ROSTER_CATEGORY_LABELS[stock.rosterCategory]}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">{NULL_DISPLAY}</span>
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* 評価行 */}
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-background font-medium text-muted-foreground text-sm">
              評価
            </TableCell>
            {stocks.map((stock) => (
              <TableCell key={stock.id} className="text-center">
                {stock.rating != null ? (
                  <span className="text-yellow-500">{'★'.repeat(stock.rating)}<span className="text-muted-foreground text-xs ml-1">{stock.rating}/5</span></span>
                ) : (
                  <span className="text-muted-foreground">{NULL_DISPLAY}</span>
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* 優先順行 */}
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-background font-medium text-muted-foreground text-sm">
              購入優先順
            </TableCell>
            {stocks.map((stock) => (
              <TableCell key={stock.id} className="text-center tabular-nums">
                {stock.buyPriority ?? <span className="text-muted-foreground">{NULL_DISPLAY}</span>}
              </TableCell>
            ))}
          </TableRow>

          {/* カテゴリごとの指標行 */}
          {COMPARISON_CATEGORIES.map((category) => (
            <>
              <TableRow key={`header-${category.title}`}>
                <TableCell
                  colSpan={stocks.length + 1}
                  className="sticky left-0 z-10 bg-muted/50 font-semibold text-sm"
                >
                  {category.title}
                </TableCell>
              </TableRow>
              {category.indicators.map((indicator) => {
                const values = getComparisonValues(allResults, indicator.field);
                const bestIdx = findBestIndex(values, indicator.direction);
                const formatFn = FORMAT_FNS[indicator.format];

                return (
                  <TableRow key={indicator.field}>
                    <TableCell className="sticky left-0 z-10 bg-background text-muted-foreground text-sm">
                      {indicator.label}
                    </TableCell>
                    {values.map((value, i) => (
                      <TableCell
                        key={stocks[i].id}
                        className={`text-center tabular-nums ${i === bestIdx ? 'font-bold text-teal-700' : ''}`}
                      >
                        {formatFn(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
