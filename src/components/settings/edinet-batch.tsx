/**
 * EDINET マスタデータのバッチ取得UI（設定画面に配置）
 *
 * 2ステップで実行:
 * Step 1: 日付範囲の書類一覧を取得 → メタデータのみ DB 登録（高速、1日数秒）
 * Step 2: pending レコードの CSV/XBRL を1件ずつ取得・パース（進捗がリアルタイム更新）
 */
'use client';

import { useState } from 'react';
import { Database, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerMasterMetadata, getPendingMasterRecords, extractSingleMasterRecord } from '@/actions/edinet-master';

export function EdinetBatchSection() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);

    // --- Step 1: メタデータ登録（高速） ---
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let totalRegistered = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      setProgress(`Step 1/2: ${dateStr} の書類一覧を取得中... (${i + 1}/${totalDays}日)`);

      try {
        const result = await registerMasterMetadata(dateStr);
        if (result.success) totalRegistered += result.registered;
      } catch {
        // 個別日付のエラーはスキップ
      }
    }

    setProgress(`Step 1 完了: ${totalRegistered}件を登録。Step 2: 財務データを抽出中...`);

    // --- Step 2: pending レコードを1件ずつパース ---
    const { data: pending } = await getPendingMasterRecords();
    let extracted = 0;

    for (const record of pending) {
      extracted++;
      setProgress(
        `Step 2/2: ${record.filer_name}（${record.fiscal_year}）を処理中... (${extracted}/${pending.length}件)`,
      );

      try {
        await extractSingleMasterRecord(record.doc_id);
      } catch {
        // エラーはDB側でerrorステータスに記録済み
      }
    }

    setIsRunning(false);
    setProgress(null);
    toast.success(`完了: ${totalRegistered}件登録、${extracted}件の財務データを抽出しました`);
  };

  /** 検索範囲の日数と推定時間 */
  const days = Math.max(0, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  )) + 1;
  const estimatedMinutes = Math.ceil(days * 0.1) + 1; // Step 1 は高速

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">EDINET マスタデータ取得</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        指定した日付範囲で EDINET に提出された有価証券報告書を取得し、財務データを抽出してマスタに保存します。
      </p>
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="batch-start" className="text-sm text-muted-foreground">開始日</label>
            <Input
              id="batch-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
              disabled={isRunning}
            />
          </div>
          <div>
            <label htmlFor="batch-end" className="text-sm text-muted-foreground">終了日</label>
            <Input
              id="batch-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
              disabled={isRunning}
            />
          </div>
          <div>
            <Button onClick={handleRun} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  実行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  バッチ取得を実行
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              {days}日間
            </p>
          </div>
        </div>
        {progress && (
          <p className="text-sm text-muted-foreground animate-pulse">{progress}</p>
        )}
      </div>
    </section>
  );
}
