/**
 * ユーザー設定の Server Actions
 * APIキー等の個人設定を user_settings テーブルに保存する
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveSetting(
  key: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: '認証が必要です' };

  const { error } = await supabase.from('user_settings').upsert(
    { user_id: user.id, setting_key: key, setting_value: value },
    { onConflict: 'user_id,setting_key' },
  );

  if (error) return { success: false, error: '設定の保存に失敗しました' };
  revalidatePath('/stocks');
  return { success: true };
}

export async function getSetting(key: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('user_settings')
    .select('setting_value')
    .eq('user_id', user.id)
    .eq('setting_key', key)
    .maybeSingle();

  return data?.setting_value ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  const { data } = await supabase
    .from('user_settings')
    .select('setting_key, setting_value')
    .eq('user_id', user.id);

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    result[row.setting_key] = row.setting_value;
  }
  return result;
}
