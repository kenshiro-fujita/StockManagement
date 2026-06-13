import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { connection } from 'next/server';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StockDeleteButton } from '@/components/stocks/stock-delete-button';
import { StockDetailClient } from '@/components/stocks/stock-detail-client';
import { RosterSection } from '@/components/stocks/roster-section';
import { StarRating } from '@/components/stocks/star-rating';
import { BuyPriorityInput } from '@/components/stocks/buy-priority-input';
import { createClient } from '@/lib/supabase/server';

async function StockDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const supabase = await createClient();

  const [{ data: stock }, { data: financialData }, { data: parametersData }] = await Promise.all([
    supabase
      .from('stocks')
      .select('id, stock_code, company_name, market, sector, business_segment, business_description, roster_category, rating, buy_priority')
      .eq('id', id)
      .single(),
    supabase
      .from('financial_data')
      .select(
        'id, fiscal_year, fiscal_quarter, consolidation_type, revenue, operating_income, net_income, total_assets, equity, interest_bearing_debt, operating_cf, investing_cf, shares_outstanding, interest_expense, current_stock_price, cash_and_equivalents, current_assets, investments_and_other_assets, current_liabilities, non_current_liabilities, shareholders_equity, beta, input_unit'
      )
      .eq('stock_id', id)
      .order('fiscal_year', { ascending: false }),
    supabase
      .from('parameters')
      .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier')
      .eq('stock_id', id)
      .maybeSingle(),
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
  const sortedFinancialData = [...(financialData ?? [])].sort((a, b) => {
    if (a.fiscal_year !== b.fiscal_year)
      return b.fiscal_year - a.fiscal_year;
    return (QUARTER_ORDER[a.fiscal_quarter] ?? 99) -
      (QUARTER_ORDER[b.fiscal_quarter] ?? 99);
  });

  // Convert NUMERIC (string from Supabase) to number, or null if not yet created
  const initialParameters = parametersData
    ? {
        id: parametersData.id,
        stock_id: parametersData.stock_id,
        discount_rate: Number(parametersData.discount_rate),
        growth_rate: Number(parametersData.growth_rate),
        tax_rate: Number(parametersData.tax_rate),
        cap_multiplier: Number(parametersData.cap_multiplier),
      }
    : null;

  const overviewContent = (
    <div className="space-y-6">
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
      {stock.business_description && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">事業概要</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {stock.business_description}
          </p>
        </div>
      )}
      <RosterSection
        stockId={stock.id}
        currentCategory={stock.roster_category}
      />
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">評価</span>
          <StarRating stockId={stock.id} currentRating={stock.rating} />
        </div>
        <BuyPriorityInput
          stockId={stock.id}
          currentPriority={stock.buy_priority}
        />
      </div>
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

      <StockDetailClient
        stockId={stock.id}
        stockCode={stock.stock_code}
        financialData={sortedFinancialData}
        initialParameters={initialParameters}
        overviewContent={overviewContent}
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
