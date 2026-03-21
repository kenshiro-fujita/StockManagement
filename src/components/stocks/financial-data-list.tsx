'use client';

import { useMemo } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FISCAL_QUARTER_LABELS,
  CONSOLIDATION_TYPE_LABELS,
} from '@/lib/schemas/financial-data';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';

function formatAmount(value: number): string {
  const inMillion = value / 1_000_000;
  return new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 0,
  }).format(inMillion);
}

/** Calculate YoY change rate. Returns null if previous is 0. */
export function calcChangeRate(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatChangeRate(rate: number): string {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

/** Build a lookup map keyed by "quarter:consolidation_type:year" */
function buildPeriodMap(data: FullFinancialDataRow[]) {
  const map = new Map<string, FullFinancialDataRow>();
  for (const row of data) {
    const key = `${row.fiscal_quarter}:${row.consolidation_type}:${row.fiscal_year}`;
    map.set(key, row);
  }
  return map;
}

// Fields that show YoY change (flow metrics only)
const CHANGE_FIELDS = ['revenue', 'operating_income', 'net_income'] as const;

function ChangeRateLabel({ rate }: { rate: number }) {
  const formatted = formatChangeRate(rate);
  const isZero = rate === 0;
  const direction = isZero ? '横ばい' : rate > 0 ? '増加' : '減少';
  const colorClass = isZero
    ? 'text-muted-foreground'
    : rate > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <span
      className={`block text-xs ${colorClass}`}
      aria-label={`前年比 ${formatted} ${direction}`}
    >
      {formatted}
    </span>
  );
}

export function FinancialDataList({
  data,
  onEdit,
}: {
  data: FullFinancialDataRow[];
  onEdit?: (row: FullFinancialDataRow) => void;
}) {
  const periodMap = useMemo(() => buildPeriodMap(data), [data]);

  const getPrevYear = (row: FullFinancialDataRow): FullFinancialDataRow | undefined => {
    const key = `${row.fiscal_quarter}:${row.consolidation_type}:${row.fiscal_year - 1}`;
    return periodMap.get(key);
  };

  return (
    <Table>
      <caption className="sr-only">財務データ推移</caption>
      <TableHeader>
        <TableRow>
          <TableHead>期間</TableHead>
          <TableHead>区分</TableHead>
          <TableHead className="text-right">
            売上高（百万円）
          </TableHead>
          <TableHead className="text-right">
            営業利益（百万円）
          </TableHead>
          <TableHead className="text-right">
            純利益（百万円）
          </TableHead>
          <TableHead className="text-right">
            総資産（百万円）
          </TableHead>
          <TableHead className="text-right">
            自己資本（百万円）
          </TableHead>
          {onEdit && <TableHead className="w-16" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const prev = getPrevYear(row);

          // Pre-calculate change rates for flow metrics
          const changes: Partial<Record<typeof CHANGE_FIELDS[number], number | null>> = {};
          if (prev) {
            for (const field of CHANGE_FIELDS) {
              changes[field] = calcChangeRate(row[field], prev[field]);
            }
          }

          return (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {row.fiscal_year}{' '}
                {FISCAL_QUARTER_LABELS[row.fiscal_quarter] ?? row.fiscal_quarter}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {CONSOLIDATION_TYPE_LABELS[row.consolidation_type] ??
                  row.consolidation_type}
              </TableCell>

              {/* Revenue */}
              <TableCell className="text-right tabular-nums">
                {formatAmount(row.revenue)}
                {changes.revenue != null && <ChangeRateLabel rate={changes.revenue} />}
              </TableCell>

              {/* Operating Income */}
              <TableCell className="text-right tabular-nums">
                {formatAmount(row.operating_income)}
                {changes.operating_income != null && <ChangeRateLabel rate={changes.operating_income} />}
              </TableCell>

              {/* Net Income */}
              <TableCell className="text-right tabular-nums">
                {formatAmount(row.net_income)}
                {changes.net_income != null && <ChangeRateLabel rate={changes.net_income} />}
              </TableCell>

              {/* Total Assets (stock metric — no YoY) */}
              <TableCell className="text-right tabular-nums">
                {formatAmount(row.total_assets)}
              </TableCell>

              {/* Equity (stock metric — no YoY) */}
              <TableCell className="text-right tabular-nums">
                {formatAmount(row.equity)}
              </TableCell>

              {onEdit && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(row)}
                    aria-label={`${row.fiscal_year} ${FISCAL_QUARTER_LABELS[row.fiscal_quarter] ?? row.fiscal_quarter} のデータを編集`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
