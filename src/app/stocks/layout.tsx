import { Suspense } from 'react';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
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
      <Suspense fallback={<AppSidebar />}>
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
