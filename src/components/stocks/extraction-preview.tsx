'use client';

import { useState } from 'react';
import { Check, Loader2, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { saveExtractedData, checkExistingFinancialData } from '@/actions/edinet';
import type { ExtractionSummary, ExtractionResult } from '@/lib/edinet/csv-parser';
import { NULL_DISPLAY } from '@/lib/format';

type EditableValue = {
  metricKey: string;
  label: string;
  value: string; // フォーム上は文字列
  matchedTag: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export function ExtractionPreview({
  stockId,
  extraction,
  onSaved,
}: {
  stockId: string;
  extraction: ExtractionSummary;
  onSaved?: () => void;
}) {
  const [editableValues, setEditableValues] = useState<EditableValue[]>(
    extraction.results.map((r) => ({
      metricKey: r.metricKey,
      label: r.label,
      value: r.value != null ? String(r.value) : '',
      matchedTag: r.matchedTag,
      confidence: r.confidence,
    })),
  );

  // 年度は期末日から推定、ユーザーが変更可能
  const defaultYear = extraction.periodEnd
    ? new Date(extraction.periodEnd).getFullYear()
    : new Date().getFullYear();

  const [fiscalYear, setFiscalYear] = useState(String(defaultYear));
  const [fiscalQuarter, setFiscalQuarter] = useState('FY');
  const [consolidationType, setConsolidationType] = useState('consolidated');
  const [isSaving, setIsSaving] = useState(false);
  const [dataSaved, setDataSaved] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

  const handleValueChange = (metricKey: string, newValue: string) => {
    setEditableValues((prev) =>
      prev.map((v) =>
        v.metricKey === metricKey ? { ...v, value: newValue } : v,
      ),
    );
  };

  const buildModifiedExtraction = (): ExtractionSummary => {
    return {
      ...extraction,
      results: editableValues.map((ev) => ({
        metricKey: ev.metricKey as ExtractionResult['metricKey'],
        label: ev.label,
        value: ev.value === '' ? null : Number(ev.value),
        matchedTag: ev.matchedTag,
        contextId: null,
        confidence: ev.confidence,
      })),
    };
  };

  const handleSaveClick = async () => {
    const year = parseInt(fiscalYear, 10);
    if (isNaN(year)) {
      toast.error('年度を正しく入力してください');
      return;
    }

    // 既存データチェック
    const existing = await checkExistingFinancialData(
      stockId,
      year,
      fiscalQuarter,
      consolidationType,
    );

    if (existing.exists) {
      setShowOverwriteDialog(true);
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    setShowOverwriteDialog(false);
    setIsSaving(true);

    const modified = buildModifiedExtraction();
    const result = await saveExtractedData(
      stockId,
      modified,
      parseInt(fiscalYear, 10),
      fiscalQuarter,
      consolidationType,
    );

    setIsSaving(false);

    if (result.success) {
      setDataSaved(true);
      toast.success(`${fiscalYear}年度の財務データを保存しました`);
      onSaved?.();
    } else {
      toast.error(result.error ?? '保存に失敗しました');
    }
  };

  const nullCount = editableValues.filter((v) => v.value === '').length;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          抽出結果（{extraction.accountingStandard}）
          {extraction.periodEnd && (
            <span className="ml-2 font-normal text-muted-foreground">
              期末: {extraction.periodEnd}
            </span>
          )}
        </h4>
        {dataSaved ? (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <Check className="mr-1 h-3 w-3" />
            保存済み
          </Badge>
        ) : (
          <Button size="sm" onClick={handleSaveClick} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            財務データに反映
          </Button>
        )}
      </div>

      {/* 年度・四半期・連結区分 */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="fiscal-year" className="text-xs text-muted-foreground">
            年度
          </label>
          <Input
            id="fiscal-year"
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="w-24"
            disabled={dataSaved}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">四半期</label>
          <Select value={fiscalQuarter} onValueChange={setFiscalQuarter} disabled={dataSaved}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FY">通年</SelectItem>
              <SelectItem value="Q1">Q1</SelectItem>
              <SelectItem value="Q2">Q2</SelectItem>
              <SelectItem value="Q3">Q3</SelectItem>
              <SelectItem value="Q4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">連結区分</label>
          <Select value={consolidationType} onValueChange={setConsolidationType} disabled={dataSaved}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consolidated">連結</SelectItem>
              <SelectItem value="standalone">単体</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {nullCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {nullCount}件の項目が未抽出です。手動で入力できます。
        </div>
      )}

      {/* 編集可能テーブル */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>項目</TableHead>
            <TableHead className="w-48">値</TableHead>
            <TableHead>タグ</TableHead>
            <TableHead>信頼度</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {editableValues.map((ev) => (
            <TableRow
              key={ev.metricKey}
              className={ev.value === '' ? 'bg-amber-50/50' : ''}
            >
              <TableCell className="text-sm">{ev.label}</TableCell>
              <TableCell>
                {dataSaved ? (
                  <span className="tabular-nums font-medium">
                    {ev.value ? Number(ev.value).toLocaleString() : NULL_DISPLAY}
                  </span>
                ) : (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={ev.value}
                    onChange={(e) => handleValueChange(ev.metricKey, e.target.value)}
                    placeholder="手動入力"
                    className={`w-40 tabular-nums ${ev.value === '' ? 'border-amber-300' : ''}`}
                    aria-label={`${ev.label} の値`}
                  />
                )}
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {ev.matchedTag ?? NULL_DISPLAY}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    ev.confidence === 'high'
                      ? 'text-green-700 border-green-300'
                      : ev.confidence === 'medium'
                        ? 'text-yellow-700 border-yellow-300'
                        : 'text-red-700 border-red-300'
                  }
                >
                  {ev.confidence === 'high' ? '高' : ev.confidence === 'medium' ? '中' : '低'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* 上書き確認ダイアログ */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>既存データを上書きしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {fiscalYear}年度（{fiscalQuarter}、{consolidationType === 'consolidated' ? '連結' : '単体'}）
              の財務データが既に存在します。上書きすると元のデータは失われます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={doSave}>上書き保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
