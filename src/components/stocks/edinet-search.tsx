/**
 * EDINET 財務データ取得セクション
 *
 * 1. edinet_master テーブルから即座に検索（API呼び出しなし）
 * 2. マスタにあれば「取り込む」ボタンで financial_data にコピー
 * 3. マスタに無い場合は従来の EDINET API 検索にフォールバック
 */
'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
import { searchMasterByStockCode, importMasterToFinancialData } from '@/actions/edinet-master';
import { NULL_DISPLAY } from '@/lib/format';

type MasterRow = {
  id: string;
  doc_id: string;
  sec_code: string;
  filer_name: string;
  fiscal_year: number;
  period_start: string | null;
  period_end: string | null;
  accounting_standard: string | null;
  // DB 上は DEFAULT 'pending' 付きの nullable カラムのため null を許容する
  extraction_status: string | null;
  revenue: number | null;
  operating_income: number | null;
  net_income: number | null;
  total_assets: number | null;
  equity: number | null;
  shares_outstanding: number | null;
};

function formatMillion(value: number | null): string {
  if (value == null) return NULL_DISPLAY;
  return `${Math.round(value / 1_000_000).toLocaleString()}百万`;
}

export function EdinetSearch({
  stockId,
  stockCode,
}: {
  stockId: string;
  stockCode: string;
}) {
  const router = useRouter();
  const [masterData, setMasterData] = useState<MasterRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [importingDocId, setImportingDocId] = useState<string | null>(null);
  const [importedDocIds, setImportedDocIds] = useState<Set<string>>(new Set());

  // ページ表示時にマスタから即座に検索
  useEffect(() => {
    (async () => {
      const result = await searchMasterByStockCode(stockCode);
      setMasterData(result.data ?? []);
      setIsLoading(false);
    })();
  }, [stockCode]);

  const handleImport = async (docId: string, fiscalYear: number) => {
    setImportingDocId(docId);
    const result = await importMasterToFinancialData(stockId, docId);
    setImportingDocId(null);

    if (result.success) {
      setImportedDocIds((prev) => new Set([...prev, docId]));
      toast.success(`${fiscalYear}年度の財務データを取り込みました`);
      router.refresh();
    } else {
      toast.error(result.error ?? '取り込みに失敗しました');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">マスタデータを検索中...</span>
      </div>
    );
  }

  if (!masterData || masterData.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Database className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">マスタデータがありません</h3>
          <p className="text-muted-foreground mb-2">
            証券コード {stockCode} の有価証券報告書がマスタに登録されていません。
          </p>
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-800 space-y-1 max-w-md">
            <p className="font-medium">マスタデータの取得方法</p>
            <p>ユーザー設定画面で EDINET API キーを登録した上で、管理画面からバッチ取得を実行してください。</p>
            <p>将来的には Cron で自動取得されるようになります。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">EDINET 財務データ（マスタ）</h3>
        <Badge variant="outline" className="text-xs">
          {masterData.length}件
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        EDINET から事前取得済みの財務データです。「取り込む」を押すとこの銘柄の財務データに反映されます。
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>年度</TableHead>
            <TableHead>基準</TableHead>
            <TableHead className="text-right">売上高</TableHead>
            <TableHead className="text-right">営業利益</TableHead>
            <TableHead className="text-right">純利益</TableHead>
            <TableHead className="text-right">総資産</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {masterData.map((row) => (
            <TableRow key={row.doc_id}>
              <TableCell className="font-medium">
                <div>
                  {row.fiscal_year}
                  <span className="text-xs text-muted-foreground ml-1">通期</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.period_start} 〜 {row.period_end}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {row.accounting_standard ?? '不明'}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatMillion(row.revenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatMillion(row.operating_income)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatMillion(row.net_income)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatMillion(row.total_assets)}
              </TableCell>
              <TableCell>
                {importedDocIds.has(row.doc_id) ? (
                  <Button size="sm" variant="ghost" disabled>
                    <Check className="mr-1 h-4 w-4 text-green-600" />
                    取込済み
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleImport(row.doc_id, row.fiscal_year)}
                    disabled={importingDocId === row.doc_id}
                  >
                    {importingDocId === row.doc_id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-4 w-4" />
                    )}
                    取り込む
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
