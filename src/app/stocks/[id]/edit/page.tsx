import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { StockForm } from '@/components/stocks/stock-form';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';

async function StockEditForm({ params }: { params: Promise<{ id: string }> }) {
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
