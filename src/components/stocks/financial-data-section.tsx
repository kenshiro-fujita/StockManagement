'use client';

import { useCallback, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { FinancialDataList } from '@/components/stocks/financial-data-list';
import { FinancialDataForm, type ExistingPeriod } from '@/components/stocks/financial-data-form';
import { FinancialDataEmpty } from '@/components/stocks/financial-data-empty';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';

export function FinancialDataSection({
  stockId,
  financialData,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
}) {
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
    // Scroll to edit form after React re-renders
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

  const hasFinancialData = financialData.length > 0;

  return (
    <div className="space-y-8">
      {hasFinancialData ? (
        <>
          <FinancialDataList data={financialData} onEdit={handleEdit} />

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
                <Plus className="h-4 w-4 transition-transform group-open:rotate-45" />
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
  );
}
