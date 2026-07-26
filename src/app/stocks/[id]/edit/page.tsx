/**
 * 銘柄IDを検証して編集対象を取得し、取得失敗と未存在を区別します。
 */
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { StockForm } from '@/components/stocks/stock-form';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';
import { stockIdSchema } from '@/lib/schemas/common';
import { assertQueriesSucceeded } from '@/lib/supabase/query-error';

async function StockEditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsedId = stockIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  await connection();
  const supabase = await createClient();
  const stockResult = await supabase
    .from('stocks')
    .select('id, stock_code, company_name, market, sector, business_segment')
    .eq('id', parsedId.data)
    .maybeSingle();

  assertQueriesSucceeded('編集対象銘柄の取得', [stockResult]);
  const stock = stockResult.data;
  if (!stock) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-bold">銘柄編集</h1>
      <StockForm stock={stock} />
    </div>
  );
}

function StockEditSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Skeleton className="h-9 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function StockEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<StockEditSkeleton />}>
      <StockEditForm params={params} />
    </Suspense>
  );
}
