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
import {
  registerMasterMetadata,
  getPendingMasterRecords,
  extractSingleMasterRecord,
} from '@/actions/edinet-master';
import { validateDateRange } from '@/lib/edinet/date-range';

/** ローカルタイム基準の今日（UTCだとJSTの朝に「昨日」がデフォルトになるのを避ける） */
function localToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('sv-SE'); // sv-SE ロケールは YYYY-MM-DD 形式
}

export function EdinetBatchSection() {
  const [startDate, setStartDate] = useState(() => localToday(-7));
  const [endDate, setEndDate] = useState(() => localToday());
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleRun = async () => {
    // 開始>終了・不正日付・範囲超過をガードする（最大6か月）
    const range = validateDateRange(startDate, endDate);
    if (!range.ok) {
      toast.error(range.error);
      return;
    }

    setIsRunning(true);
    let totalRegistered = 0;
    let metadataFailures = 0;
    let extracted = 0;
    let extractionFailures = 0;

    try {
      // --- Step 1: メタデータ登録（高速） ---
      const totalDays = range.days;
      const start = new Date(`${startDate}T00:00:00Z`);

      for (let i = 0; i < totalDays; i++) {
        // 日付の加算・整形は UTC で一貫させます。
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + i);
        const dateString = date.toISOString().slice(0, 10);
        setProgress(
          `Step 1/2: ${dateString} の書類一覧を取得中... (${i + 1}/${totalDays}日)`
        );

        try {
          const result = await registerMasterMetadata(dateString);
          if (result.success) {
            totalRegistered += result.registered;
          } else {
            metadataFailures += 1;
          }
        } catch {
          metadataFailures += 1;
        }
      }

      setProgress(
        `Step 1 完了: ${totalRegistered}件を登録。Step 2: 財務データを抽出中...`
      );

      // --- Step 2: pending レコードを1件ずつパース ---
      const pendingResult = await getPendingMasterRecords();
      if (!pendingResult.success) {
        throw new Error(pendingResult.error);
      }
      const pendingRecords = pendingResult.data;

      for (const record of pendingRecords) {
        extracted += 1;
        setProgress(
          `Step 2/2: ${record.filer_name}（${record.fiscal_year}）を処理中... (${extracted}/${pendingRecords.length}件)`
        );

        try {
          const result = await extractSingleMasterRecord(record.doc_id);
          if (!result.success) {
            extractionFailures += 1;
          }
        } catch {
          extractionFailures += 1;
        }
      }

      const message = `${totalRegistered}件登録、${extracted - extractionFailures}件の財務データを抽出しました`;
      if (metadataFailures > 0 || extractionFailures > 0) {
        toast.warning(
          `一部失敗しました。${message}（一覧取得失敗 ${metadataFailures}日、抽出失敗 ${extractionFailures}件）`
        );
      } else {
        toast.success(`完了: ${message}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'EDINETバッチの実行に失敗しました'
      );
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  /** 検索範囲の日数（表示用） */
  const displayRange = validateDateRange(startDate, endDate);
  const days = displayRange.ok ? displayRange.days : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">EDINET マスタデータ取得</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        指定した日付範囲で EDINET
        に提出された有価証券報告書を取得し、財務データを抽出してマスタに保存します。
      </p>
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="batch-start"
              className="text-sm text-muted-foreground"
            >
              開始日
            </label>
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
            <label
              htmlFor="batch-end"
              className="text-sm text-muted-foreground"
            >
              終了日
            </label>
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
            <p className="mt-1 text-xs text-muted-foreground">{days}日間</p>
          </div>
        </div>
        {progress && (
          <p
            className="animate-pulse text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {progress}
          </p>
        )}
      </div>
    </section>
  );
}
