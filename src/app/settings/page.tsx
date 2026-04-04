import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsForm } from '@/components/settings/settings-form';
import { getAllSettings } from '@/actions/settings';
import { connection } from 'next/server';

async function SettingsContent() {
  await connection();
  const settings = await getAllSettings();

  return <SettingsForm initialSettings={settings} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold">設定</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
