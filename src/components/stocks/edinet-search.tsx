'use client';

import { useState } from 'react';
import { Search, FileText, Check, AlertCircle, Loader2, Download, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { searchEdinetDocuments, saveEdinetDocument, extractFinancialData, saveExtractedData } from '@/actions/edinet';
import type { AnnualReport } from '@/lib/edinet/types';
import type { ExtractionSummary } from '@/lib/edinet/csv-parser';
import { NULL_DISPLAY } from '@/lib/format';

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
  const [isSavingData, setIsSavingData] = useState(false);
  const [results, setResults] = useState<AnnualReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDocIds, setSavedDocIds] = useState<Set<string>>(new Set());
  const [extraction, setExtraction] = useState<ExtractionSummary | null>(null);
  const [extractionDocID, setExtractionDocID] = useState<string | null>(null);
  const [dataSaved, setDataSaved] = useState(false);

  // デフォルト: 直近1年間を検索
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const [startDate, setStartDate] = useState(oneYearAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

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

  const handleExtract = async (docID: string) => {
    setIsExtracting(docID);
    setExtraction(null);
    setDataSaved(false);

    const result = await extractFinancialData(docID);

    setIsExtracting(null);

    if (result.success && result.data) {
      setExtraction(result.data);
      setExtractionDocID(docID);
      toast.success('財務データを抽出しました');
    } else {
      toast.error(result.error ?? 'データ抽出に失敗しました');
    }
  };

  const handleSaveData = async () => {
    if (!extraction || !extractionDocID) return;

    // 期末日から年度を推定
    const periodEnd = extraction.periodEnd;
    const fiscalYear = periodEnd
      ? new Date(periodEnd).getFullYear()
      : new Date().getFullYear();

    setIsSavingData(true);
    const result = await saveExtractedData(stockId, extraction, fiscalYear);
    setIsSavingData(false);

    if (result.success) {
      setDataSaved(true);
      toast.success(`${fiscalYear}年度の財務データを保存しました`);
    } else {
      toast.error(result.error ?? '保存に失敗しました');
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
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              検索中...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              EDINET検索
            </>
          )}
        </Button>
      </div>

      {isSearching && (
        <p className="text-sm text-muted-foreground">
          EDINET APIを日付ごとに検索しています。しばらくお待ちください...
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
                      {report.csvFlag && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExtract(report.docID)}
                          disabled={isExtracting === report.docID}
                        >
                          {isExtracting === report.docID ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-1 h-4 w-4" />
                          )}
                          データ取得
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

      {/* 抽出結果プレビュー */}
      {extraction && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              抽出結果（{extraction.accountingStandard}）
              {extraction.periodEnd && <span className="ml-2 text-muted-foreground font-normal">期末: {extraction.periodEnd}</span>}
            </h4>
            {dataSaved ? (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                <Check className="mr-1 h-3 w-3" />
                保存済み
              </Badge>
            ) : (
              <Button size="sm" onClick={handleSaveData} disabled={isSavingData}>
                {isSavingData ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                財務データに反映
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>項目</TableHead>
                <TableHead className="text-right">抽出値</TableHead>
                <TableHead>マッチしたタグ</TableHead>
                <TableHead>信頼度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extraction.results.map((r) => (
                <TableRow key={r.metricKey}>
                  <TableCell className="text-sm">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {r.value != null ? r.value.toLocaleString() : NULL_DISPLAY}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {r.matchedTag ?? NULL_DISPLAY}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.confidence === 'high'
                          ? 'text-green-700 border-green-300'
                          : r.confidence === 'medium'
                            ? 'text-yellow-700 border-yellow-300'
                            : 'text-red-700 border-red-300'
                      }
                    >
                      {r.confidence === 'high' ? '高' : r.confidence === 'medium' ? '中' : '低'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {extraction.results.some((r) => r.value === null) && (
            <p className="text-xs text-muted-foreground">
              値が「—」の項目は自動抽出できませんでした。保存後に手動で編集できます。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
