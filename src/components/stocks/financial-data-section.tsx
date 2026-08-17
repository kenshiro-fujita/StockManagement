/**
 * 財務データセクション — EDINET取込とスプレッドシート風グリッドを連続表示します。
 *
 * 取得結果を先に表示することで、利用者が自動取込と手動入力を同じ導線で
 * 選択でき、取込直後に反映先のデータも確認できます。
 */
'use client';

import { FinancialDataGrid } from '@/components/stocks/financial-data-grid';
import { EdinetSearch } from '@/components/stocks/edinet-search';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';

export function FinancialDataSection({
  stockId,
  stockCode,
  financialData,
  parameters,
}: {
  stockId: string;
  stockCode: string;
  financialData: FullFinancialDataRow[];
  parameters?: ParametersRow | null;
}) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="edinet-import-heading" className="space-y-4">
        <div>
          <h2 id="edinet-import-heading" className="text-lg font-semibold">
            EDINETから取り込む
          </h2>
          <p className="text-sm text-muted-foreground">
            取得済みの年次財務データを確認し、この銘柄へ取り込みます。
          </p>
        </div>
        <EdinetSearch stockId={stockId} stockCode={stockCode} />
      </section>

      <section aria-labelledby="financial-grid-heading" className="space-y-4">
        <div>
          <h2 id="financial-grid-heading" className="text-lg font-semibold">
            財務データを入力・編集する
          </h2>
          <p className="text-sm text-muted-foreground">
            EDINETから取り込んだ値を確認し、必要に応じて手動で編集できます。
          </p>
        </div>
        <FinancialDataGrid
          stockId={stockId}
          financialData={financialData}
          parameters={parameters ?? null}
        />
      </section>
    </div>
  );
}
