import { StockForm } from '@/components/stocks/stock-form';

export default function NewStockPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">銘柄登録</h1>
      <StockForm />
    </div>
  );
}
