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
import { AppSidebar } from '@/components/layout/app-sidebar';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';

async function SidebarWithStocks() {
  await connection();
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from('stocks')
    .select('id, stock_code, company_name')
    .order('created_at', { ascending: false });

  return <AppSidebar stocks={stocks ?? []} />;
}

export default function StocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '15rem',
        } as React.CSSProperties
      }
    >
      <Suspense
        fallback={
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-sidebar-foreground text-lg font-bold">
                  StockManagement
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
