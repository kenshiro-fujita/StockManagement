/**
 * EDINET マスタデータのバッチ取得UI（設定画面に配置）
 *
 * 指定した日付範囲の有報をEDINET APIから取得し、
 * edinet_master テーブルに保存する。
 */
'use client';

import { useState } from 'react';
import { Database, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAndStoreMasterData } from '@/actions/edinet-master';

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
    setProgress('処理を開始しています...');

    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalAdded = 0;
    let totalProcessed = 0;
    let daysProcessed = 0;
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      daysProcessed++;
      setProgress(`${dateStr} を処理中... (${daysProcessed}/${totalDays}日)`);

      try {
        const result = await fetchAndStoreMasterData(dateStr);
        if (result.success) {
          totalAdded += result.added;
          totalProcessed += result.processed;
        }
      } catch {
        // 個別日付のエラーはスキップ
      }
    }

    setIsRunning(false);
    setProgress(null);
    toast.success(`完了: ${totalProcessed}件処理、${totalAdded}件を新規追加しました`);
  };

  const days = Math.max(0, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  )) + 1;
  const estimatedMinutes = Math.ceil((days * 5) / 60);

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
              {days}日間（約{estimatedMinutes}分）
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
