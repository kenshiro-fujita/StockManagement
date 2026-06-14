/**
 * ポートフォリオ（保有一覧・損益サマリー）ページ
 *
 * 全銘柄の保有ポジション・評価額・含み損益・実現損益と、銘柄別の売買シグナルを一覧する。
 * スプレッドシートの「保有一覧」相当のビュー。
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TradeSignalBadge } from '@/components/stocks/trade-signal-badge';
import { getPortfolioSummary } from '@/lib/stocks/portfolio-summary';
import { formatCurrency, formatStockPrice, NULL_DISPLAY } from '@/lib/format';

/** 損益を符号色つきで表示 */
function PL({ value, percent }: { value: number | null; percent?: number | null }) {
  if (value == null) return <span className="text-muted-foreground">{NULL_DISPLAY}</span>;
  const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-muted-foreground';
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`${color} tabular-nums`}>
      {sign}{formatCurrency(value)}
      {percent != null && <span className="ml-1 text-xs">（{sign}{percent}%）</span>}
    </span>
  );
}

/** サマリーカード */
function TotalCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{children}</p>
    </div>
  );
}

async function PortfolioContent() {
  await connection();
  const { rows, totals } = await getPortfolioSummary();

  if (rows.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        取引履歴がまだありません。各銘柄の「取引・損益」タブから売買を記録すると、ここに保有状況が表示されます。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* 合計サマリー */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <TotalCard label="保有銘柄数">{totals.holdingCount}銘柄</TotalCard>
        <TotalCard label="取得原価合計">{formatCurrency(totals.bookValue)}</TotalCard>
        <TotalCard label="評価額合計">{formatCurrency(totals.marketValue)}</TotalCard>
        <TotalCard label="含み損益">
          <PL value={totals.unrealizedPL} percent={totals.unrealizedPLPercent} />
        </TotalCard>
        <TotalCard label="実現損益（累計）">
          <PL value={totals.realizedPL} />
        </TotalCard>
      </div>

      {/* 銘柄別ポジション */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>銘柄</TableHead>
              <TableHead className="text-center">シグナル</TableHead>
              <TableHead className="text-right">保有株数</TableHead>
              <TableHead className="text-right">平均取得単価</TableHead>
              <TableHead className="text-right">現在株価</TableHead>
              <TableHead className="text-right">理論株価</TableHead>
              <TableHead className="text-right">評価額</TableHead>
              <TableHead className="text-right">含み損益</TableHead>
              <TableHead className="text-right">実現損益</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.stockId}>
                <TableCell>
                  <Link href={`/stocks/${r.stockId}`} className="font-medium underline-offset-4 hover:underline">
                    {r.stockCode} {r.companyName}
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  <TradeSignalBadge signal={r.signal} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.quantity > 0 ? `${r.quantity.toLocaleString('ja-JP')}株` : NULL_DISPLAY}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.averageCost != null ? formatStockPrice(r.averageCost) : NULL_DISPLAY}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.currentPrice != null ? formatStockPrice(r.currentPrice) : NULL_DISPLAY}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.theoryPrice != null ? formatStockPrice(r.theoryPrice) : NULL_DISPLAY}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.marketValue != null ? formatCurrency(r.marketValue) : NULL_DISPLAY}
                </TableCell>
                <TableCell className="text-right">
                  <PL value={r.unrealizedPL} percent={r.unrealizedPLPercent} />
                </TableCell>
                <TableCell className="text-right">
                  <PL value={r.realizedPL} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">ポートフォリオ</h1>
      <Suspense fallback={<PortfolioSkeleton />}>
        <PortfolioContent />
      </Suspense>
    </div>
  );
}
