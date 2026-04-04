/**
 * 財務データセクション
 *
 * デフォルトでスプレッドシート風グリッド表示。
 * 「従来の入力フォーム」リンクで1期ずつの詳細入力にも切り替え可能。
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import { Grid3X3, FormInput } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FinancialDataGrid } from '@/components/stocks/financial-data-grid';
import { FinancialDataList } from '@/components/stocks/financial-data-list';
import { FinancialDataForm, type ExistingPeriod } from '@/components/stocks/financial-data-form';
import { FinancialDataEmpty } from '@/components/stocks/financial-data-empty';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';

type ViewMode = 'grid' | 'form';

export function FinancialDataSection({
  stockId,
  financialData,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [editingData, setEditingData] = useState<FullFinancialDataRow | null>(null);
  const formDirtyRef = useRef(false);
  const editFormRef = useRef<HTMLDivElement>(null);

  const existingPeriods: ExistingPeriod[] = financialData.map((d) => ({
    fiscal_year: d.fiscal_year,
    fiscal_quarter: d.fiscal_quarter,
    consolidation_type: d.consolidation_type,
  }));

  const handleDirtyChange = useCallback((dirty: boolean) => {
    formDirtyRef.current = dirty;
  }, []);

  const handleEdit = useCallback((row: FullFinancialDataRow) => {
    if (formDirtyRef.current) {
      if (!window.confirm('未保存の変更があります。破棄して別のデータを編集しますか？')) {
        return;
      }
    }
    setEditingData(row);
    requestAnimationFrame(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleSuccess = useCallback(() => {
    setEditingData(null);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingData(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* 表示切り替え */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('grid')}
        >
          <Grid3X3 className="mr-1 h-4 w-4" />
          表形式
        </Button>
        <Button
          variant={viewMode === 'form' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('form')}
        >
          <FormInput className="mr-1 h-4 w-4" />
          フォーム入力
        </Button>
      </div>

      {viewMode === 'grid' ? (
        <FinancialDataGrid stockId={stockId} financialData={financialData} />
      ) : (
        /* 従来のフォーム入力モード */
        <div className="space-y-8">
          {financialData.length > 0 ? (
            <>
              <FinancialDataList data={financialData} onEdit={handleEdit} />

              {financialData.length === 1 && (
                <p className="text-muted-foreground text-sm">
                  複数期のデータを入力すると推移を比較できます
                </p>
              )}

              {editingData ? (
                <div ref={editFormRef} className="rounded-lg border p-6">
                  <h3 className="mb-4 text-lg font-semibold">
                    {editingData.fiscal_year}{' '}
                    {editingData.fiscal_quarter === 'FY' ? '通期' : `第${editingData.fiscal_quarter.replace('Q', '')}四半期`}
                    {' '}のデータを編集
                  </h3>
                  <FinancialDataForm
                    key={editingData.id}
                    stockId={stockId}
                    editData={editingData}
                    existingPeriods={existingPeriods}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                    onDirtyChange={handleDirtyChange}
                  />
                </div>
              ) : (
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    新しい期間のデータを追加する
                  </summary>
                  <div className="mt-4">
                    <FinancialDataForm
                      stockId={stockId}
                      existingPeriods={existingPeriods}
                      onSuccess={handleSuccess}
                    />
                  </div>
                </details>
              )}
            </>
          ) : (
            <>
              <FinancialDataEmpty />
              <FinancialDataForm
                stockId={stockId}
                existingPeriods={existingPeriods}
                onSuccess={handleSuccess}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
