/**
 * 管理画面ダッシュボード
 * マスタデータの統計情報とクイックアクションを表示する。
 */
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { Database, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

async function MasterStats() {
  await connection();
  const supabase = await createClient();

  const [{ count: totalCount }, { count: doneCount }, { count: pendingCount }, { count: errorCount }] =
    await Promise.all([
      supabase.from('edinet_master').select('*', { count: 'exact', head: true }),
      supabase.from('edinet_master').select('*', { count: 'exact', head: true }).eq('extraction_status', 'done'),
      supabase.from('edinet_master').select('*', { count: 'exact', head: true }).eq('extraction_status', 'pending'),
      supabase.from('edinet_master').select('*', { count: 'exact', head: true }).eq('extraction_status', 'error'),
    ]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Database className="h-5 w-5 text-blue-500" />}
        label="マスタ総数"
        value={totalCount ?? 0}
      />
      <StatCard
        icon={<CheckCircle className="h-5 w-5 text-green-500" />}
        label="抽出完了"
        value={doneCount ?? 0}
      />
      <StatCard
        icon={<Clock className="h-5 w-5 text-amber-500" />}
        label="抽出待ち"
        value={pendingCount ?? 0}
      />
      <StatCard
        icon={<AlertCircle className="h-5 w-5 text-red-500" />}
        label="エラー"
        value={errorCount ?? 0}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">管理ダッシュボード</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">EDINET マスタデータ</h2>
        <MasterStats />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">クイックアクション</h2>
        <div className="flex gap-3">
          <Link
            href="/ops-819a1ec26e72/batch"
            className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <p className="font-medium">バッチ取得</p>
            <p className="text-sm text-muted-foreground">EDINET から有報を取得・パース</p>
          </Link>
          <Link
            href="/ops-819a1ec26e72/master"
            className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <p className="font-medium">マスタ管理</p>
            <p className="text-sm text-muted-foreground">登録済みデータの一覧・エラー確認</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
