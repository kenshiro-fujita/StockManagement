'use client';

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';

import { FinancialDataList } from '@/components/stocks/financial-data-list';
import { FinancialDataForm, type ExistingPeriod } from '@/components/stocks/financial-data-form';
import { FinancialDataEmpty } from '@/components/stocks/financial-data-empty';

export type FullFinancialDataRow = {
  id: string;
  fiscal_year: number;
  fiscal_quarter: string;
  consolidation_type: string;
  revenue: number;
  operating_income: number;
  net_income: number;
  total_assets: number;
  equity: number;
  interest_bearing_debt: number | null;
  operating_cf: number | null;
  investing_cf: number | null;
  shares_outstanding: number | null;
  interest_expense: number | null;
  current_stock_price: number | null;
  input_unit: string;
};

export function FinancialDataSection({
  stockId,
  financialData,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
}) {
  const [editingData, setEditingData] = useState<FullFinancialDataRow | null>(null);

  const existingPeriods: ExistingPeriod[] = financialData.map((d) => ({
    fiscal_year: d.fiscal_year,
    fiscal_quarter: d.fiscal_quarter,
    consolidation_type: d.consolidation_type,
  }));

  const handleEdit = useCallback((row: FullFinancialDataRow) => {
    setEditingData(row);
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
            <div className="rounded-lg border p-6">
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
