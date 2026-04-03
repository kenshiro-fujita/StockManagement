import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StockTable, type StockWithIndicators } from '@/components/stocks/stock-table';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { calculateAllIndicators } from '@/lib/calc';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { RosterCategory } from '@/lib/types/roster';

async function StockList() {
  await connection();
  const supabase = await createClient();

  // 3テーブルを並列クエリ（N+1回避）
  const [{ data: stocks }, { data: allFinancialData }, { data: allParameters }] =
    await Promise.all([
      supabase
        .from('stocks')
        .select('id, stock_code, company_name, market, sector, roster_category')
        .order('created_at', { ascending: false }),
      supabase
        .from('financial_data')
        .select('*')
        .order('fiscal_year', { ascending: false }),
      supabase
        .from('parameters')
        .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier'),
    ]);

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

  // stock_id ごとにグループ化
  const financialByStock = new Map<string, FullFinancialDataRow[]>();
  for (const fd of allFinancialData ?? []) {
    const list = financialByStock.get(fd.stock_id) ?? [];
    list.push(fd as FullFinancialDataRow);
    financialByStock.set(fd.stock_id, list);
  }

  const paramsByStock = new Map<string, ParametersRow>();
  for (const p of allParameters ?? []) {
    paramsByStock.set(p.stock_id as string, {
      id: p.id as string,
      stock_id: p.stock_id as string,
      discount_rate: Number(p.discount_rate),
      growth_rate: Number(p.growth_rate),
      tax_rate: Number(p.tax_rate),
      cap_multiplier: Number(p.cap_multiplier),
    });
  }

  // 銘柄ごとに指標を計算
  const stocksWithIndicators: StockWithIndicators[] = stocks.map((stock) => {
    const fd = financialByStock.get(stock.id) ?? [];
    const params = paramsByStock.get(stock.id) ?? null;

    let theoryPrice: number | null = null;
    let safetyRateCurrent: number | null = null;

    if (fd.length > 0 && params != null) {
      try {
        const results = calculateAllIndicators(fd, params);
        theoryPrice = results.period.theoryPrice.value;
        safetyRateCurrent = results.period.safetyRateCurrent.value;
      } catch {
        // 計算失敗時は null のまま
      }
    }

    return {
      ...stock,
      theoryPrice,
      safetyRateCurrent,
      rosterCategory: (stock.roster_category as RosterCategory | null) ?? null,
    };
  });

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
