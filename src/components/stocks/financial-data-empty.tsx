import { FileSpreadsheet } from 'lucide-react';

export function FinancialDataEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileSpreadsheet className="text-muted-foreground mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-semibold">
        財務データが登録されていません
      </h3>
      <p className="text-muted-foreground mb-4">
        財務データを入力して分析を始めましょう
      </p>
    </div>
  );
}
