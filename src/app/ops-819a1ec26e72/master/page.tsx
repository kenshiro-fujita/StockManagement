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
import { assertQueriesSucceeded } from '@/lib/supabase/query-error';

const PAGE_SIZE = 50;
const MASTER_STATUSES = new Set(['all', 'done', 'pending', 'error']);

/** URL由来のページ番号を正の整数へ制限し、不正値は先頭へ戻します。 */
function normalizePage(rawPage: string | undefined): number {
  if (!rawPage || !/^\d+$/.test(rawPage)) return 1;
  const page = Number(rawPage);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** DBフィルタへ渡せる既知ステータスだけを許可します。 */
function normalizeStatus(rawStatus: string | undefined): string {
  return rawStatus && MASTER_STATUSES.has(rawStatus) ? rawStatus : 'all';
}

async function MasterDataContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await connection();
  const { status, page } = await searchParams;
  const supabase = await createClient();
  const currentStatus = normalizeStatus(status);
  const currentPage = normalizePage(page);
  const offset = (currentPage - 1) * PAGE_SIZE;

  let query = supabase
    .from('edinet_master')
    .select(
      'doc_id, sec_code, filer_name, fiscal_year, extraction_status, error_message, accounting_standard, fetched_at, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (currentStatus !== 'all') {
    query = query.eq('extraction_status', currentStatus);
  }

  const queryResult = await query;
  assertQueriesSucceeded('EDINETマスタの取得', [queryResult]);
  const { data, count } = queryResult;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <MasterDataTable
      data={data ?? []}
      totalCount={count ?? 0}
      currentPage={currentPage}
      totalPages={totalPages}
      currentStatus={currentStatus}
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
