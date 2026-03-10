'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
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
    <Button variant="outline" onClick={handleLogout} disabled={isLoading}>
      {isLoading ? 'ログアウト中...' : 'ログアウト'}
    </Button>
  );
}
