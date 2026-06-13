import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ComparisonTable } from '@/components/stocks/comparison-table';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { calculateAllIndicators } from '@/lib/calc';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { IndicatorResults } from '@/lib/types/calc';

function CompareEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 className="text-muted-foreground mb-4 h-12 w-12" />
      <h2 className="text-xl font-semibold">銘柄を選択してください</h2>
      <p className="mt-2 text-muted-foreground">
        銘柄一覧で2件以上の銘柄を選択し、「比較する」ボタンを押してください
      </p>
      <Button asChild className="mt-6">
        <Link href="/stocks">
          <ArrowLeft className="mr-2 h-4 w-4" />
          銘柄一覧に戻る
        </Link>
      </Button>
    </div>
  );
}

async function ComparisonContent({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  if (!ids) return <CompareEmpty />;

  const stockIds = ids.split(',').filter(Boolean);
  if (stockIds.length < 2) return <CompareEmpty />;

  await connection();
  const supabase = await createClient();

  const [{ data: stocks }, { data: allFinancialData }, { data: allParameters }] =
    await Promise.all([
      supabase
        .from('stocks')
        .select('id, stock_code, company_name, roster_category, rating, buy_priority')
        .in('id', stockIds),
      supabase
        .from('financial_data')
        .select('*')
        .in('stock_id', stockIds)
        .order('fiscal_year', { ascending: false }),
      supabase
        .from('parameters')
        .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier')
        .in('stock_id', stockIds),
    ]);

  if (!stocks || stocks.length === 0) return <CompareEmpty />;

  // stock_id ごとにグループ化
  const financialByStock = new Map<string, FullFinancialDataRow[]>();
  for (const fd of allFinancialData ?? []) {
    const list = financialByStock.get(fd.stock_id) ?? [];
    list.push(fd);
    financialByStock.set(fd.stock_id, list);
  }

  const paramsByStock = new Map<string, ParametersRow>();
  for (const p of allParameters ?? []) {
    paramsByStock.set(p.stock_id, {
      id: p.id,
      stock_id: p.stock_id,
      discount_rate: Number(p.discount_rate),
      growth_rate: Number(p.growth_rate),
      tax_rate: Number(p.tax_rate),
      cap_multiplier: Number(p.cap_multiplier),
    });
  }

  // 銘柄ID順序を維持（URLクエリパラメータの順序）
  const orderedStocks = stockIds
    .map((id) => stocks.find((s) => s.id === id))
    .filter(Boolean) as typeof stocks;

  const comparisonStocks = orderedStocks.map((stock) => {
    const fd = financialByStock.get(stock.id) ?? [];
    const params = paramsByStock.get(stock.id) ?? null;

    let results: IndicatorResults | null = null;
    if (fd.length > 0 && params != null) {
      try {
        results = calculateAllIndicators(fd, params);
      } catch {
        // 計算失敗時は null
      }
    }

    return {
      id: stock.id,
      stock_code: stock.stock_code,
      company_name: stock.company_name,
      // Database 型の導入によりクエリ結果が型付くため、キャスト不要
      rosterCategory: stock.roster_category,
      rating: stock.rating,
      buyPriority: stock.buy_priority,
      results,
    };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/stocks">
              <ArrowLeft className="mr-2 h-4 w-4" />
              一覧に戻る
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">銘柄比較</h1>
          <span className="text-sm text-muted-foreground">
            {comparisonStocks.length}件
          </span>
        </div>
      </div>
      <ComparisonTable stocks={comparisonStocks} />
    </div>
  );
}

function CompareSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  return (
    <Suspense fallback={<CompareSkeleton />}>
      <ComparisonContent searchParams={searchParams} />
    </Suspense>
  );
}
