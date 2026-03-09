import { LogoutButton } from '@/components/logout-button';

export default function StocksPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold">StockManagement</h1>
      <p className="mt-4 text-muted-foreground">
        銘柄を登録して分析を始めましょう
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}
