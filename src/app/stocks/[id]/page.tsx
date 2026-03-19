import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { connection } from 'next/server';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StockDeleteButton } from '@/components/stocks/stock-delete-button';
import { StockDetailTabs } from '@/components/stocks/stock-detail-tabs';
import { FinancialDataForm } from '@/components/stocks/financial-data-form';
import { FinancialDataList } from '@/components/stocks/financial-data-list';
import { FinancialDataEmpty } from '@/components/stocks/financial-data-empty';
import { createClient } from '@/lib/supabase/server';

async function StockDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const supabase = await createClient();

  const [{ data: stock }, { data: financialData }] = await Promise.all([
    supabase
      .from('stocks')
      .select('id, stock_code, company_name, market, sector, business_segment')
      .eq('id', id)
      .single(),
    supabase
      .from('financial_data')
      .select(
        'id, fiscal_year, fiscal_quarter, consolidation_type, revenue, operating_income, net_income, total_assets, equity'
      )
      .eq('stock_id', id)
      .order('fiscal_year', { ascending: false }),
  ]);

  if (!stock) notFound();

  // Sort fiscal_quarter: FY first, then Q4→Q1 within same year
  const QUARTER_ORDER: Record<string, number> = {
    FY: 0,
    Q4: 1,
    Q3: 2,
    Q2: 3,
    Q1: 4,
  };
  const sortedFinancialData = financialData?.sort((a, b) => {
    if (a.fiscal_year !== b.fiscal_year)
      return b.fiscal_year - a.fiscal_year;
    return (QUARTER_ORDER[a.fiscal_quarter] ?? 99) -
      (QUARTER_ORDER[b.fiscal_quarter] ?? 99);
  });

  const overviewContent = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
      <dt className="font-medium text-muted-foreground">銘柄コード</dt>
      <dd>{stock.stock_code}</dd>
      <dt className="font-medium text-muted-foreground">企業名</dt>
      <dd>{stock.company_name}</dd>
      <dt className="font-medium text-muted-foreground">市場</dt>
      <dd>{stock.market ?? '—'}</dd>
      <dt className="font-medium text-muted-foreground">業種</dt>
      <dd>{stock.sector ?? '—'}</dd>
      <dt className="font-medium text-muted-foreground">事業セグメント</dt>
      <dd>{stock.business_segment ?? '—'}</dd>
    </dl>
  );

  const hasFinancialData = sortedFinancialData && sortedFinancialData.length > 0;

  const existingPeriods = (financialData ?? []).map((d) => ({
    fiscal_year: d.fiscal_year,
    fiscal_quarter: d.fiscal_quarter,
    consolidation_type: d.consolidation_type,
  }));

  const financialContent = (
    <div className="space-y-8">
      {hasFinancialData ? (
        <>
          <FinancialDataList data={sortedFinancialData} />
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Plus className="h-4 w-4 transition-transform group-open:rotate-45" />
              新しい期間のデータを追加する
            </summary>
            <div className="mt-4">
              <FinancialDataForm stockId={stock.id} existingPeriods={existingPeriods} />
            </div>
          </details>
        </>
      ) : (
        <>
          <FinancialDataEmpty />
          <FinancialDataForm stockId={stock.id} existingPeriods={existingPeriods} />
        </>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {stock.stock_code} {stock.company_name}
        </h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/stocks/${stock.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              編集
            </Link>
          </Button>
          <StockDeleteButton
            stockId={stock.id}
            stockName={stock.company_name}
          />
        </div>
      </div>

      <StockDetailTabs
        overviewContent={overviewContent}
        financialContent={financialContent}
      />
    </div>
  );
}

function StockDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <Skeleton className="h-9 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-64" />
        ))}
      </div>
    </div>
  );
}

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<StockDetailSkeleton />}>
      <StockDetail params={params} />
    </Suspense>
  );
}
