'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutList, LogOut, Settings } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { formatStockPrice } from '@/lib/format';
import type { RosterCategory } from '@/lib/types/roster';
import { ROSTER_CATEGORY_SHORT_LABELS } from '@/lib/schemas/roster';

export type SidebarStock = {
  id: string;
  stock_code: string;
  company_name: string;
  theoryPrice: number | null;
  rosterCategory: RosterCategory | null;
};

export function AppSidebar({ stocks = [] }: { stocks?: SidebarStock[] }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/stocks" className="flex items-center gap-2 px-2 py-1 hover:opacity-80 transition-opacity">
          <span className="text-sidebar-foreground text-lg font-bold">
            株式分析ツール
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* ナビゲーション */}
        <SidebarGroup>
          <SidebarGroupLabel>メニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith('/stocks')}
                  asChild
                >
                  <Link href="/stocks">
                    <LayoutList />
                    <span>銘柄一覧</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith('/settings')}
                  asChild
                >
                  <Link href="/settings">
                    <Settings />
                    <span>ユーザー設定</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 銘柄リスト */}
        <SidebarGroup>
          <SidebarGroupLabel>銘柄リスト</SidebarGroupLabel>
          <SidebarGroupContent>
            {stocks.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                銘柄を登録しましょう
              </p>
            ) : (
              <SidebarMenu>
                {stocks.map((stock) => (
                  <SidebarMenuItem key={stock.id}>
                    <SidebarMenuButton
                      isActive={pathname === `/stocks/${stock.id}`}
                      asChild
                    >
                      <Link href={`/stocks/${stock.id}`}>
                        <span className="truncate">
                          {stock.stock_code} {stock.company_name}
                        </span>
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                          {stock.rosterCategory && (
                            <span className="shrink-0">{ROSTER_CATEGORY_SHORT_LABELS[stock.rosterCategory]}</span>
                          )}
                          <span className="tabular-nums">{formatStockPrice(stock.theoryPrice)}</span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarLogoutButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarLogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    setIsLoading(true);

    try {
      await supabase.auth.signOut();
      router.refresh();
      router.push('/auth/login');
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2"
      onClick={handleLogout}
      disabled={isLoading}
    >
      <LogOut className="h-4 w-4" />
      {isLoading ? 'ログアウト中...' : 'ログアウト'}
    </Button>
  );
}
