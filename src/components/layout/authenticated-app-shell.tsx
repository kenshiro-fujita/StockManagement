/**
 * 認証済み画面で共通利用するアプリケーションシェルです。
 *
 * `/stocks` と `/settings` で認証ゲート・銘柄サイドバー・モバイルヘッダーを
 * 別々に持つと挙動がずれるため、データ取得を含めてこの境界に集約します。
 */
import { Suspense, type CSSProperties, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { AppSidebar, type SidebarStock } from '@/components/layout/app-sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { getStocksWithIndicators } from '@/lib/stocks/stocks-with-indicators';
import { createClient } from '@/lib/supabase/server';

const APP_SHELL_STYLE = {
  '--sidebar-width': '15rem',
} as CSSProperties;

/** サイドバー用の表示モデルだけを渡し、取得結果の不要な列をクライアントへ送らないようにします。 */
async function SidebarWithStocks() {
  await connection();
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

/** 読み込み中もサイドバーの占有幅を保ち、本文のレイアウトシフトを防ぎます。 */
function SidebarFallback() {
  return (
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
  );
}

async function AuthenticatedContent({ children }: { children: ReactNode }) {
  // Cache Components では認証cookieへ触れる前に動的レンダリングを明示します。
  await connection();
  // Proxy だけに依存せず、Server Component 側でも利用者を検証します。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <SidebarProvider style={APP_SHELL_STYLE}>
      <Suspense fallback={<SidebarFallback />}>
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

/** 認証判定中もサイドバーと本文の占有領域を保つシェルです。 */
function AuthenticatedShellFallback() {
  return (
    <SidebarProvider style={APP_SHELL_STYLE}>
      <SidebarFallback />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="flex-1 space-y-4 p-6" aria-busy="true">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-64 w-full" />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AuthenticatedAppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AuthenticatedShellFallback />}>
      <AuthenticatedContent>{children}</AuthenticatedContent>
    </Suspense>
  );
}
