/**
 * 管理画面: マスタデータ一覧・管理
 *
 * 登録済みの EDINET マスタデータを一覧表示し、
 * ステータス（完了/待ち/エラー）でフィルタできる。
 * エラーのレコードは再実行ボタンで再パース可能。
 */
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { Skeleton } from '@/components/ui/skeleton';
import { MasterDataTable } from '@/components/admin/master-data-table';

async function MasterDataContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await connection();
  const { status, page } = await searchParams;
  const supabase = await createClient();
  const pageSize = 50;
  const currentPage = parseInt(page ?? '1', 10);
  const offset = (currentPage - 1) * pageSize;

  let query = supabase
    .from('edinet_master')
    .select('doc_id, sec_code, filer_name, fiscal_year, extraction_status, error_message, accounting_standard, fetched_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (status && status !== 'all') {
    query = query.eq('extraction_status', status);
  }

  const { data, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <MasterDataTable
      data={data ?? []}
      totalCount={count ?? 0}
      currentPage={currentPage}
      totalPages={totalPages}
      currentStatus={status ?? 'all'}
    />
  );
}

export default function AdminMasterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">マスタデータ管理</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <MasterDataContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
