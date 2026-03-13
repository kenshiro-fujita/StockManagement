import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StocksPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-3xl font-bold">銘柄一覧</h1>
      <p className="mt-4 text-muted-foreground">
        銘柄を登録して分析を始めましょう
      </p>
      <Button asChild className="mt-6">
        <Link href="/stocks/new">
          <Plus className="mr-2 h-4 w-4" />
          銘柄を登録する
        </Link>
      </Button>
    </div>
  );
}
