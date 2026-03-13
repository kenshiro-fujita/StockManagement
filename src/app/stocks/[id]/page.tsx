import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { connection } from 'next/server';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StockDeleteButton } from '@/components/stocks/stock-delete-button';
import { createClient } from '@/lib/supabase/server';

async function StockDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const supabase = await createClient();
  const { data: stock } = await supabase
    .from('stocks')
    .select('id, stock_code, company_name, market, sector, business_segment')
    .eq('id', id)
    .single();

  if (!stock) notFound();

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
