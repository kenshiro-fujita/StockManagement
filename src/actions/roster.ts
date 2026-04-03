'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  updateRosterSchema,
  updateRatingSchema,
  updateBuyPrioritySchema,
  type UpdateRosterInput,
  type UpdateRatingInput,
  type UpdateBuyPriorityInput,
} from '@/lib/schemas/roster';
import type { RosterCategory } from '@/lib/types/roster';

export async function updateRosterCategory(
  data: UpdateRosterInput,
): Promise<{ success: boolean; error?: string }> {
  const parsed = updateRosterSchema.safeParse(data);
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

  // 現在のカテゴリを取得
  const { data: stock } = await supabase
    .from('stocks')
    .select('roster_category')
    .eq('id', parsed.data.stock_id)
    .single();

  if (!stock) {
    return { success: false, error: '銘柄が見つかりません' };
  }

  const fromCategory = (stock.roster_category as RosterCategory | null) ?? null;

  // 同じカテゴリへの変更は無視
  if (fromCategory === parsed.data.category) {
    return { success: false, error: '同じカテゴリです' };
  }

  // stocks テーブルの roster_category を更新
  const { error: updateError } = await supabase
    .from('stocks')
    .update({ roster_category: parsed.data.category })
    .eq('id', parsed.data.stock_id);

  if (updateError) {
    return { success: false, error: '分類の更新に失敗しました' };
  }

  // roster_history に変更履歴を追加
  const { error: historyError } = await supabase.from('roster_history').insert({
    user_id: user.id,
    stock_id: parsed.data.stock_id,
    from_category: fromCategory,
    to_category: parsed.data.category,
    reason: parsed.data.reason,
  });

  if (historyError) {
    // 履歴の書き込みに失敗しても分類自体は更新済み
    console.error('roster_history insert failed:', historyError);
  }

  revalidatePath('/stocks');
  return { success: true };
}

export async function updateStockRating(
  data: UpdateRatingInput,
): Promise<{ success: boolean; error?: string }> {
  const parsed = updateRatingSchema.safeParse(data);
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

  const { error } = await supabase
    .from('stocks')
    .update({ rating: parsed.data.rating })
    .eq('id', parsed.data.stock_id);

  if (error) {
    return { success: false, error: '評価の更新に失敗しました' };
  }

  revalidatePath('/stocks');
  return { success: true };
}

export async function updateBuyPriority(
  data: UpdateBuyPriorityInput,
): Promise<{ success: boolean; error?: string }> {
  const parsed = updateBuyPrioritySchema.safeParse(data);
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

  const { error } = await supabase
    .from('stocks')
    .update({ buy_priority: parsed.data.buy_priority })
    .eq('id', parsed.data.stock_id);

  if (error) {
    return { success: false, error: '優先順の更新に失敗しました' };
  }

  revalidatePath('/stocks');
  return { success: true };
}
