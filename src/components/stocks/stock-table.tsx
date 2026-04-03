'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
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
import { formatStockPrice, formatPercent, NULL_DISPLAY } from '@/lib/format';
import { getValuationLevel } from '@/lib/calc/safety';
import type { RosterCategory } from '@/lib/types/roster';
import {
  ROSTER_CATEGORY_LABELS,
  ROSTER_BADGE_STYLES,
} from '@/lib/schemas/roster';

export type StockWithIndicators = {
  id: string;
  stock_code: string;
  company_name: string;
  market: string | null;
  sector: string | null;
  theoryPrice: number | null;
  safetyRateCurrent: number | null;
  rosterCategory: RosterCategory | null;
  rating: number | null;
  buyPriority: number | null;
};

const SAFETY_RATE_COLORS: Record<string, string> = {
  cheap: 'text-green-600',
  fair: 'text-yellow-600',
  expensive: 'text-red-600',
};

export function StockTable({ stocks }: { stocks: StockWithIndicators[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === stocks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stocks.map((s) => s.id)));
    }
  };

  const handleCompare = () => {
    const ids = Array.from(selectedIds).join(',');
    router.push(`/stocks/compare?ids=${ids}`);
  };

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size}件選択中
          </span>
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={selectedIds.size < 2}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            比較する
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={stocks.length > 0 && selectedIds.size === stocks.length}
                onChange={toggleAll}
                aria-label="すべての銘柄を選択"
                className="h-4 w-4 rounded border-gray-300"
              />
            </TableHead>
            <TableHead>銘柄コード</TableHead>
            <TableHead>企業名</TableHead>
            <TableHead>ロースター</TableHead>
            <TableHead>市場</TableHead>
            <TableHead>業種</TableHead>
            <TableHead className="text-center">評価</TableHead>
            <TableHead className="tabular-nums text-center">優先順</TableHead>
            <TableHead className="tabular-nums text-right">理論株価</TableHead>
            <TableHead className="tabular-nums text-right">安全率</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => {
            const level = getValuationLevel(stock.safetyRateCurrent);
            const safetyColorClass = level ? SAFETY_RATE_COLORS[level] : '';
            const isSelected = selectedIds.has(stock.id);

            return (
              <TableRow key={stock.id} className={isSelected ? 'bg-muted/50' : ''}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(stock.id)}
                    aria-label={`${stock.stock_code} ${stock.company_name} を選択`}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/stocks/${stock.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {stock.stock_code}
                  </Link>
                </TableCell>
                <TableCell>{stock.company_name}</TableCell>
                <TableCell>
                  {stock.rosterCategory ? (
                    <Badge variant="outline" className={ROSTER_BADGE_STYLES[stock.rosterCategory].className}>
                      {ROSTER_CATEGORY_LABELS[stock.rosterCategory]}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{NULL_DISPLAY}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {stock.market ?? NULL_DISPLAY}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {stock.sector ?? NULL_DISPLAY}
                </TableCell>
                <TableCell className="text-center">
                  {stock.rating != null ? (
                    <span className="text-yellow-500">{'★'.repeat(stock.rating)}</span>
                  ) : (
                    <span className="text-muted-foreground">{NULL_DISPLAY}</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-center text-muted-foreground">
                  {stock.buyPriority ?? NULL_DISPLAY}
                </TableCell>
                <TableCell className="tabular-nums text-right text-muted-foreground">
                  {formatStockPrice(stock.theoryPrice)}
                </TableCell>
                <TableCell className={`tabular-nums text-right ${safetyColorClass || 'text-muted-foreground'}`}>
                  {stock.safetyRateCurrent != null ? formatPercent(stock.safetyRateCurrent) : NULL_DISPLAY}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
