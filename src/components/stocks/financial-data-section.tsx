/**
 * 財務データセクション — スプレッドシート風グリッド表示
 */
'use client';

import { FinancialDataGrid } from '@/components/stocks/financial-data-grid';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';

export function FinancialDataSection({
  stockId,
  financialData,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
}) {
  return <FinancialDataGrid stockId={stockId} financialData={financialData} />;
}
