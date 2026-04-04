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
import { calculateAllIndicators } from '@/lib/calc';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';
import type { ParametersRow } from '@/lib/types/parameters';
import type { RosterCategory } from '@/lib/types/roster';

async function SidebarWithStocks() {
  await connection();
  const supabase = await createClient();

  const [{ data: stocks }, { data: allFinancialData }, { data: allParameters }] =
    await Promise.all([
      supabase
        .from('stocks')
        .select('id, stock_code, company_name, roster_category')
        .order('created_at', { ascending: false }),
      supabase
        .from('financial_data')
        .select('*')
        .order('fiscal_year', { ascending: false }),
      supabase
        .from('parameters')
        .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier'),
    ]);

  // stock_id ごとにグループ化
  const financialByStock = new Map<string, FullFinancialDataRow[]>();
  for (const fd of allFinancialData ?? []) {
    const list = financialByStock.get(fd.stock_id) ?? [];
    list.push(fd as FullFinancialDataRow);
    financialByStock.set(fd.stock_id, list);
  }

  const paramsByStock = new Map<string, ParametersRow>();
  for (const p of allParameters ?? []) {
    paramsByStock.set(p.stock_id as string, {
      id: p.id as string,
      stock_id: p.stock_id as string,
      discount_rate: Number(p.discount_rate),
      growth_rate: Number(p.growth_rate),
      tax_rate: Number(p.tax_rate),
      cap_multiplier: Number(p.cap_multiplier),
    });
  }

  const sidebarStocks: SidebarStock[] = (stocks ?? []).map((stock) => {
    const fd = financialByStock.get(stock.id) ?? [];
    const params = paramsByStock.get(stock.id) ?? null;

    let theoryPrice: number | null = null;
    if (fd.length > 0 && params != null) {
      try {
        const results = calculateAllIndicators(fd, params);
        theoryPrice = results.period.theoryPrice.value;
      } catch {
        // 計算失敗時は null のまま
      }
    }

    return {
      ...stock,
      theoryPrice,
      rosterCategory: (stock.roster_category as RosterCategory | null) ?? null,
    };
  });

  return <AppSidebar stocks={sidebarStocks} />;
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
