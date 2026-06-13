import { Suspense } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { AppSidebar, type SidebarStock } from '@/components/layout/app-sidebar';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { getStocksWithIndicators } from '@/lib/stocks/stocks-with-indicators';

async function SidebarWithStocks() {
  await connection();
  // /stocks と同じ共有関数を使う。以前は roster_category と理論株価を
  // null で捨てており、/settings に移るとサイドバーのロースター表示と
  // 理論株価が消える画面間の不整合があった
  const stocks = await getStocksWithIndicators();

  const sidebarStocks: SidebarStock[] = stocks.map((stock) => ({
    id: stock.id,
    stock_code: stock.stock_code,
    company_name: stock.company_name,
    theoryPrice: stock.theoryPrice,
    rosterCategory: stock.roster_category,
  }));

  return <AppSidebar stocks={sidebarStocks} />;
}

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // middleware と二重のゲート（多層防御）。未認証ならログインへ
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return (
    <SidebarProvider
      style={{ '--sidebar-width': '15rem' } as React.CSSProperties}
    >
      <Suspense
        fallback={
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-sidebar-foreground text-lg font-bold">
                  株式分析ツール
                </span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-full" />
              </div>
            </SidebarContent>
          </Sidebar>
        }
      >
        <SidebarWithStocks />
      </Suspense>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
