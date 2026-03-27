import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatStockPrice, formatPercent, NULL_DISPLAY } from '@/lib/format';
import { getValuationLevel } from '@/components/stocks/theory-price-section';

export type StockWithIndicators = {
  id: string;
  stock_code: string;
  company_name: string;
  market: string | null;
  sector: string | null;
  theoryPrice: number | null;
  safetyRateCurrent: number | null;
};

const SAFETY_RATE_COLORS: Record<string, string> = {
  cheap: 'text-green-600',
  fair: 'text-yellow-600',
  expensive: 'text-red-600',
};

export function StockTable({ stocks }: { stocks: StockWithIndicators[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>銘柄コード</TableHead>
          <TableHead>企業名</TableHead>
          <TableHead>市場</TableHead>
          <TableHead>業種</TableHead>
          <TableHead className="tabular-nums text-right">理論株価</TableHead>
          <TableHead className="tabular-nums text-right">安全率</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stocks.map((stock) => {
          const level = getValuationLevel(stock.safetyRateCurrent);
          const safetyColorClass = level ? SAFETY_RATE_COLORS[level] : '';

          return (
            <TableRow key={stock.id}>
              <TableCell>
                <Link
                  href={`/stocks/${stock.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {stock.stock_code}
                </Link>
              </TableCell>
              <TableCell>{stock.company_name}</TableCell>
              <TableCell className="text-muted-foreground">
                {stock.market ?? NULL_DISPLAY}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {stock.sector ?? NULL_DISPLAY}
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
  );
}
