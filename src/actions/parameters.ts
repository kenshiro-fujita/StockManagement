'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  updateParametersSchema,
  type UpdateParametersInput,
} from '@/lib/schemas/parameters';
import type { ParametersRow } from '@/lib/types/parameters';
import type { Tables } from '@/lib/types/database';

export async function getOrCreateParameters(
  stockId: string
): Promise<{ success: boolean; error?: string; data?: ParametersRow }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  // Try to fetch existing parameters
  const { data: existing } = await supabase
    .from('parameters')
    .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier')
    .eq('stock_id', stockId)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return { success: true, data: toParametersRow(existing) };
  }

  // Create with defaults (DB column defaults handle the values)
  const { data: created, error } = await supabase
    .from('parameters')
    .insert({ user_id: user.id, stock_id: stockId })
    .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier')
    .single();

  if (error) {
    // UNIQUE constraint violation (concurrent tab race) — retry SELECT
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('parameters')
        .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier')
        .eq('stock_id', stockId)
        .eq('user_id', user.id)
        .single();
      if (retry) {
        return { success: true, data: toParametersRow(retry) };
      }
    }
    return { success: false, error: 'パラメータの初期化に失敗しました' };
  }

  return { success: true, data: toParametersRow(created) };
}

export async function updateParameters(
  stockId: string,
  data: UpdateParametersInput
): Promise<{ success: boolean; error?: string; data?: ParametersRow }> {
  const parsed = updateParametersSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: '入力内容に誤りがあります' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  const { data: updated, error } = await supabase
    .from('parameters')
    .update({
      discount_rate: parsed.data.discount_rate,
      growth_rate: parsed.data.growth_rate,
      tax_rate: parsed.data.tax_rate,
      cap_multiplier: parsed.data.cap_multiplier,
    })
    .eq('stock_id', stockId)
    .eq('user_id', user.id)
    .select('id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier');

  if (error) {
    return { success: false, error: 'パラメータの更新に失敗しました' };
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: '対象のパラメータが見つかりませんでした' };
  }

  revalidatePath(`/stocks/${stockId}`);
  return { success: true, data: toParametersRow(updated[0]) };
}

/** Convert Supabase NUMERIC (string) to JavaScript number */
function toParametersRow(
  // Database 型の導入によりクエリ結果が型付くため、SELECT したカラムの Pick で受ける
  row: Pick<
    Tables<'parameters'>,
    'id' | 'stock_id' | 'discount_rate' | 'growth_rate' | 'tax_rate' | 'cap_multiplier'
  >,
): ParametersRow {
  return {
    id: row.id,
    stock_id: row.stock_id,
    discount_rate: Number(row.discount_rate),
    growth_rate: Number(row.growth_rate),
    tax_rate: Number(row.tax_rate),
    cap_multiplier: Number(row.cap_multiplier),
  };
}
