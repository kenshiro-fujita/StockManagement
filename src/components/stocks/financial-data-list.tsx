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

type FinancialDataRow = {
  id: string;
  fiscal_year: number;
  fiscal_quarter: string;
  consolidation_type: string;
  revenue: number;
  operating_income: number;
  net_income: number;
  total_assets: number;
  equity: number;
};

function formatAmount(value: number): string {
  const inMillion = value / 1_000_000;
  return new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 0,
  }).format(inMillion);
}

export function FinancialDataList({ data }: { data: FinancialDataRow[] }) {
  return (
    <Table>
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              {row.fiscal_year}{' '}
              {FISCAL_QUARTER_LABELS[row.fiscal_quarter] ?? row.fiscal_quarter}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {CONSOLIDATION_TYPE_LABELS[row.consolidation_type] ??
                row.consolidation_type}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(row.revenue)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(row.operating_income)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(row.net_income)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(row.total_assets)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(row.equity)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
