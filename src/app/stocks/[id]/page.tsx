/**
 * 銘柄に紐づく定量・定性情報を並列取得し、分析タブへ引き渡します。
 */
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
import { getOrCreateParameters } from '@/actions/parameters';
import { listTransactions } from '@/actions/transactions';
import { stockIdSchema } from '@/lib/schemas/common';
import {
  assertQueriesSucceeded,
  DataAccessError,
} from '@/lib/supabase/query-error';

async function StockDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsedId = stockIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const stockId = parsedId.data;

  await connection();
  const supabase = await createClient();

  // パラメータはサーバー側で get-or-create する。
  // 以前はクライアントの useEffect で初期化しており、パラメータ未作成の銘柄で
  // 「ページ取得 → マウント → さらに API 呼び出し」のウォーターフォールが発生していた
  const [stockResult, financialDataResult, paramsResult, transactionsResult] =
    await Promise.all([
      supabase
        .from('stocks')
        .select(
          'id, stock_code, company_name, market, sector, business_segment, business_description, roster_category, rating, buy_priority'
        )
        .eq('id', stockId)
        .maybeSingle(),
      supabase
        .from('financial_data')
        .select(
          'id, fiscal_year, fiscal_quarter, consolidation_type, revenue, operating_income, net_income, total_assets, equity, interest_bearing_debt, operating_cf, investing_cf, shares_outstanding, interest_expense, current_stock_price, cash_and_equivalents, current_assets, investments_and_other_assets, current_liabilities, non_current_liabilities, shareholders_equity, beta, input_unit'
        )
        .eq('stock_id', stockId)
        .order('fiscal_year', { ascending: false }),
      getOrCreateParameters(stockId),
      listTransactions(stockId),
    ]);

  assertQueriesSucceeded('銘柄詳細の取得', [stockResult, financialDataResult]);
  const stock = stockResult.data;
  const financialData = financialDataResult.data;
  if (!stock) notFound();

  if (!paramsResult.success) {
    throw new DataAccessError('パラメータの取得', [paramsResult.error]);
  }
  if (!transactionsResult.success) {
    throw new DataAccessError('取引履歴の取得', [transactionsResult.error]);
  }

  // Sort fiscal_quarter: FY first, then Q4→Q1 within same year
  const QUARTER_ORDER: Record<string, number> = {
    FY: 0,
    Q4: 1,
    Q3: 2,
    Q2: 3,
    Q1: 4,
  };
  const sortedFinancialData = [...(financialData ?? [])].sort((a, b) => {
    if (a.fiscal_year !== b.fiscal_year) return b.fiscal_year - a.fiscal_year;
    return (
      (QUARTER_ORDER[a.fiscal_quarter] ?? 99) -
      (QUARTER_ORDER[b.fiscal_quarter] ?? 99)
    );
  });

  // get-or-create 済みで、NUMERIC→number 変換もAction境界で完了しています。
  const initialParameters = paramsResult.data;
  const transactions = transactionsResult.data;

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
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            事業概要
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
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
          <span className="text-sm font-medium text-muted-foreground">
            評価
          </span>
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
        // 銘柄間の画面遷移で編集途中のクライアント状態を持ち越さないようにします。
        key={stock.id}
        stockId={stock.id}
        stockCode={stock.stock_code}
        financialData={sortedFinancialData}
        initialParameters={initialParameters}
        transactions={transactions}
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
