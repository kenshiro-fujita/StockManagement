import { createBrowserClient } from '@supabase/ssr';
// クエリ結果に型を効かせるための手起こし Database 型（詳細は database.ts 冒頭コメント参照）
import type { Database } from '@/lib/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
