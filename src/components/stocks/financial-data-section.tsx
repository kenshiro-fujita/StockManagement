/**
 * 財務データセクション — スプレッドシート風グリッド表示
 */
'use client';

import { FinancialDataGrid } from '@/components/stocks/financial-data-grid';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';

export function FinancialDataSection({
  stockId,
  financialData,
  parameters,
}: {
  stockId: string;
  financialData: FullFinancialDataRow[];
  parameters?: ParametersRow | null;
}) {
  return <FinancialDataGrid stockId={stockId} financialData={financialData} parameters={parameters ?? null} />;
}
