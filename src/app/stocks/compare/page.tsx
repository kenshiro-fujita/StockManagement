/**
 * URLで指定された銘柄を同じ入力整形・計算手順で比較します。
 *
 * クエリ文字列はDBへ渡す前にUUID検証と重複排除を行い、取得失敗を
 * 正常な空結果として扱わないよう明示的なエラー境界へ送ります。
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ComparisonTable } from '@/components/stocks/comparison-table';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { stockIdSchema } from '@/lib/schemas/common';
import {
  calculateStockIndicators,
  groupByStockId,
  indexParametersByStockId,
  INDICATOR_COLUMNS,
} from '@/lib/stocks/indicator-data';
import { assertQueriesSucceeded } from '@/lib/supabase/query-error';

function CompareEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
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

  const stockIds = [
    ...new Set(
      ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];
  if (stockIds.length < 2) return <CompareEmpty />;
  if (stockIds.some((id) => !stockIdSchema.safeParse(id).success)) {
    return <CompareEmpty />;
  }

  await connection();
  const supabase = await createClient();

  const [stocksResult, financialDataResult, parametersResult] =
    await Promise.all([
      supabase
        .from('stocks')
        .select(
          'id, stock_code, company_name, roster_category, rating, buy_priority'
        )
        .in('id', stockIds),
      supabase
        .from('financial_data')
        .select(INDICATOR_COLUMNS)
        .in('stock_id', stockIds)
        .order('fiscal_year', { ascending: false }),
      supabase
        .from('parameters')
        .select(
          'id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier'
        )
        .in('stock_id', stockIds),
    ]);

  assertQueriesSucceeded('比較対象銘柄の取得', [
    stocksResult,
    financialDataResult,
    parametersResult,
  ]);
  const stocks = stocksResult.data;
  const allFinancialData = financialDataResult.data;
  const allParameters = parametersResult.data;
  if (!stocks || stocks.length === 0) return <CompareEmpty />;

  const financialByStock = groupByStockId(allFinancialData ?? []);
  const paramsByStock = indexParametersByStockId(allParameters ?? []);

  // 銘柄ID順序を維持（URLクエリパラメータの順序）
  const stocksById = new Map(stocks.map((stock) => [stock.id, stock]));
  const orderedStocks = stockIds.flatMap((id) => {
    const stock = stocksById.get(id);
    return stock ? [stock] : [];
  });

  const comparisonStocks = orderedStocks.map((stock) => {
    const fd = financialByStock.get(stock.id) ?? [];
    const params = paramsByStock.get(stock.id) ?? null;

    const results = calculateStockIndicators(fd, params);

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
