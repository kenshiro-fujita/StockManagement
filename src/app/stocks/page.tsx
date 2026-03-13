import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StockTable } from '@/components/stocks/stock-table';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';

async function StockList() {
  await connection();
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from('stocks')
    .select('id, stock_code, company_name, market, sector')
    .order('created_at', { ascending: false });

  if (!stocks || stocks.length === 0) {
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
      <StockTable stocks={stocks} />
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
