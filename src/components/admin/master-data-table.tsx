/**
 * マスタデータ一覧テーブル（管理画面用）
 *
 * ステータスフィルタ、ページネーション、エラーレコードの再実行を提供する。
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { extractSingleMasterRecord } from '@/actions/edinet-master';

type MasterRecord = {
  doc_id: string;
  sec_code: string;
  filer_name: string;
  fiscal_year: number;
  // extraction_status / created_at は DB 上 DEFAULT 付きの nullable カラムのため null を許容する
  extraction_status: string | null;
  error_message: string | null;
  accounting_standard: string | null;
  fetched_at: string | null;
  created_at: string | null;
};

/** ステータスに応じたバッジを表示する */
function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'done':
      return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="mr-1 h-3 w-3" />完了</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300"><Clock className="mr-1 h-3 w-3" />待ち</Badge>;
    case 'error':
      return <Badge className="bg-red-100 text-red-800 border-red-300"><AlertCircle className="mr-1 h-3 w-3" />エラー</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/** ステータスフィルタのタブ */
function StatusFilter({ currentStatus }: { currentStatus: string }) {
  const router = useRouter();
  const filters = [
    { value: 'all', label: 'すべて' },
    { value: 'done', label: '完了' },
    { value: 'pending', label: '待ち' },
    { value: 'error', label: 'エラー' },
  ];

  return (
    <div className="flex gap-1">
      {filters.map((f) => (
        <Button
          key={f.value}
          variant={currentStatus === f.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => router.push(`?status=${f.value}`)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}

export function MasterDataTable({
  data,
  totalCount,
  currentPage,
  totalPages,
  currentStatus,
}: {
  data: MasterRecord[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  currentStatus: string;
}) {
  const router = useRouter();
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);

  /** エラーレコードの再実行 */
  const handleRetry = async (docId: string) => {
    setRetryingDocId(docId);
    const result = await extractSingleMasterRecord(docId);
    setRetryingDocId(null);

    if (result.success) {
      toast.success('再抽出が完了しました');
      router.refresh();
    } else {
      toast.error(result.error ?? '再抽出に失敗しました');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusFilter currentStatus={currentStatus} />
        <span className="text-sm text-muted-foreground">{totalCount.toLocaleString()}件</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>証券コード</TableHead>
            <TableHead>企業名</TableHead>
            <TableHead>年度</TableHead>
            <TableHead>基準</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>取得日時</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                データがありません
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.doc_id}>
                <TableCell className="font-mono text-sm">{row.sec_code}</TableCell>
                <TableCell className="font-medium">{row.filer_name}</TableCell>
                <TableCell className="tabular-nums">{row.fiscal_year}</TableCell>
                <TableCell>
                  {row.accounting_standard ? (
                    <Badge variant="outline" className="text-xs">{row.accounting_standard}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.extraction_status} />
                  {row.error_message && (
                    <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={row.error_message}>
                      {row.error_message}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.fetched_at ? new Date(row.fetched_at).toLocaleString('ja-JP') : '—'}
                </TableCell>
                <TableCell>
                  {(row.extraction_status === 'error' || row.extraction_status === 'pending') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRetry(row.doc_id)}
                      disabled={retryingDocId === row.doc_id}
                    >
                      {retryingDocId === row.doc_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(`?status=${currentStatus}&page=${currentPage - 1}`)}
          >
            前へ
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(`?status=${currentStatus}&page=${currentPage + 1}`)}
          >
            次へ
          </Button>
        </div>
      )}
    </div>
  );
}
