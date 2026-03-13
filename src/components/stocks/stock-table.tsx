import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Stock = {
  id: string;
  stock_code: string;
  company_name: string;
  market: string | null;
  sector: string | null;
};

export function StockTable({ stocks }: { stocks: Stock[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>銘柄コード</TableHead>
          <TableHead>企業名</TableHead>
          <TableHead>市場</TableHead>
          <TableHead>業種</TableHead>
          <TableHead className="tabular-nums">理論株価</TableHead>
          <TableHead className="tabular-nums">安全率</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stocks.map((stock) => (
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
              {stock.market ?? '—'}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {stock.sector ?? '—'}
            </TableCell>
            <TableCell className="tabular-nums text-muted-foreground">
              —
            </TableCell>
            <TableCell className="tabular-nums text-muted-foreground">
              —
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
