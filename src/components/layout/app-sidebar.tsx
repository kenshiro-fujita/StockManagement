'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutList, LogOut } from 'lucide-react';

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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="text-sidebar-foreground text-lg font-bold">
            StockManagement
          </span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* ナビゲーション */}
        <SidebarGroup>
          <SidebarGroupLabel>メニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === '/stocks'} asChild>
                  <Link href="/stocks">
                    <LayoutList />
                    <span>銘柄一覧</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 銘柄リスト（Empty State） */}
        <SidebarGroup>
          <SidebarGroupLabel>銘柄リスト</SidebarGroupLabel>
          <SidebarGroupContent>
            <p className="px-2 py-4 text-sm text-muted-foreground">
              銘柄を登録しましょう
            </p>
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
