'use client';

import { useState } from 'react';
import { Search, FileText, Check, AlertCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { searchEdinetDocuments, saveEdinetDocument, extractFinancialData } from '@/actions/edinet';
import { ExtractionPreview } from '@/components/stocks/extraction-preview';
import type { AnnualReport } from '@/lib/edinet/types';
import type { ExtractionSummary } from '@/lib/edinet/csv-parser';

export function EdinetSearch({
  stockId,
  stockCode,
}: {
  stockId: string;
  stockCode: string;
}) {
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<string | null>(null);
  const [results, setResults] = useState<AnnualReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDocIds, setSavedDocIds] = useState<Set<string>>(new Set());
  const [extraction, setExtraction] = useState<ExtractionSummary | null>(null);

  // デフォルト: 直近2ヶ月間を検索（有報提出は決算月の約3ヶ月後）
  const today = new Date();
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setMonth(today.getMonth() - 2);

  const [startDate, setStartDate] = useState(twoMonthsAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  // 検索範囲の日数を計算
  const searchDays = Math.max(0, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  ));
  const estimatedMinutes = Math.ceil((searchDays * 3) / 60); // 3秒/日
  const isLongSearch = searchDays > 60;

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);
    setResults(null);

    const result = await searchEdinetDocuments(stockId, stockCode, startDate, endDate);

    setIsSearching(false);

    if (!result.success) {
      setError(result.error ?? 'EDINET検索に失敗しました');
      return;
    }

    setResults(result.data ?? []);
  };

  const handleExtract = async (docID: string, csvFlag: boolean) => {
    setIsExtracting(docID);
    setExtraction(null);

    const result = await extractFinancialData(docID, csvFlag);

    setIsExtracting(null);

    if (result.success && result.data) {
      setExtraction(result.data);
      toast.success('財務データを抽出しました');
    } else {
      toast.error(result.error ?? 'データ抽出に失敗しました');
    }
  };

  const handleSave = async (report: AnnualReport) => {
    setIsSaving(report.docID);
    const result = await saveEdinetDocument(stockId, report);
    setIsSaving(null);

    if (result.success) {
      setSavedDocIds((prev) => new Set([...prev, report.docID]));
      toast.success('書類を保存しました');
    } else {
      toast.error(result.error ?? '保存に失敗しました');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">EDINET 有価証券報告書検索</h3>

      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-800 space-y-1">
        <p className="font-medium">検索のコツ</p>
        <p>有価証券報告書は決算日の<strong>約3ヶ月後</strong>にEDINETに提出されます（決算発表日とは異なります）。</p>
        <p>例: 3月決算 → <strong>6月下旬</strong>頃に提出 / 12月決算 → <strong>3月下旬</strong>頃に提出</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="edinet-start" className="text-sm text-muted-foreground">
            検索開始日
          </label>
          <Input
            id="edinet-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <label htmlFor="edinet-end" className="text-sm text-muted-foreground">
            検索終了日
          </label>
          <Input
            id="edinet-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                検索中...（約{estimatedMinutes}分）
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                EDINET検索
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            検索範囲: {searchDays}日間（約{estimatedMinutes}分）
          </span>
        </div>
      </div>

      {isLongSearch && !isSearching && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm text-amber-800">
              検索範囲が{searchDays}日間（約{estimatedMinutes}分）と広く、タイムアウトする可能性があります。
            </p>
            <p className="mt-1 text-xs text-amber-600">
              有報の提出日付近（決算日の約3ヶ月後）に絞ると高速に検索できます。
            </p>
          </div>
        </div>
      )}

      {isSearching && (
        <p className="text-sm text-muted-foreground">
          EDINET APIを日付ごとに検索しています（{searchDays}日分、約{estimatedMinutes}分）。しばらくお待ちください...
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm text-red-800">{error}</p>
            <p className="mt-1 text-xs text-red-600">
              手動で財務データを入力することもできます
            </p>
          </div>
        </div>
      )}

      {results !== null && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          指定期間に有価証券報告書が見つかりませんでした
        </p>
      )}

      {results !== null && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {results.length}件の有価証券報告書が見つかりました
          </p>
          <ul className="divide-y rounded-lg border">
            {results.map((report) => (
              <li
                key={report.docID}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {report.docDescription ?? '有価証券報告書'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.periodStart} 〜 {report.periodEnd}
                      {' · '}提出: {report.submitDateTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {report.csvFlag && (
                    <Badge variant="outline" className="text-xs">CSV</Badge>
                  )}
                  {report.xbrlFlag && (
                    <Badge variant="outline" className="text-xs">XBRL</Badge>
                  )}
                  {savedDocIds.has(report.docID) ? (
                    <>
                      <Button size="sm" variant="ghost" disabled>
                        <Check className="mr-1 h-4 w-4 text-green-600" />
                        保存済み
                      </Button>
                      {(report.csvFlag || report.xbrlFlag) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExtract(report.docID, report.csvFlag)}
                          disabled={isExtracting === report.docID}
                        >
                          {isExtracting === report.docID ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-1 h-4 w-4" />
                          )}
                          データ取得{!report.csvFlag ? '(XBRL)' : ''}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleSave(report)}
                      disabled={isSaving === report.docID}
                    >
                      {isSaving === report.docID ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : null}
                      選択
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 抽出結果プレビュー（編集可能） */}
      {extraction && (
        <ExtractionPreview
          stockId={stockId}
          extraction={extraction}
        />
      )}
    </div>
  );
}
