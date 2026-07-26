import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  StockTable,
  type StockWithIndicators,
} from '@/components/stocks/stock-table';
import { Skeleton } from '@/components/ui/skeleton';
import { connection } from 'next/server';
import { getStocksWithIndicators } from '@/lib/stocks/stocks-with-indicators';

async function StockList() {
  await connection();
  // データ取得と指標計算は共有関数に集約（layout のサイドバーと cache() で結果を共有）
  const stocks = await getStocksWithIndicators();

  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-3xl font-bold">銘柄一覧</h1>
        <p className="mt-4 text-muted-foreground">
          銘柄を登録して分析を始めましょう
        </p>
        <Button asChild className="mt-6">
          <Link href="/stocks/new">
            <Plus className="mr-2 h-4 w-4" />
            銘柄を登録する
          </Link>
        </Button>
      </div>
    );
  }

  const stocksWithIndicators: StockWithIndicators[] = stocks.map((stock) => ({
    id: stock.id,
    stock_code: stock.stock_code,
    company_name: stock.company_name,
    market: stock.market,
    sector: stock.sector,
    theoryPrice: stock.theoryPrice,
    safetyRateCurrent: stock.safetyRateCurrent,
    rosterCategory: stock.roster_category,
    rating: stock.rating,
    buyPriority: stock.buy_priority,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">銘柄一覧</h1>
        <Button asChild>
          <Link href="/stocks/new">
            <Plus className="mr-2 h-4 w-4" />
            銘柄を登録する
          </Link>
        </Button>
      </div>
      <StockTable stocks={stocksWithIndicators} />
    </div>
  );
}

function StockListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function StocksPage() {
  return (
    <Suspense fallback={<StockListSkeleton />}>
      <StockList />
    </Suspense>
  );
}
