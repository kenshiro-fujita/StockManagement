/**
 * ロースター分類・評価・購入優先順の Server Actions
 *
 * - updateRosterCategory: 銘柄のロースター分類を変更し、変更履歴を記録する
 * - updateStockRating: 5段階評価（★1〜★5）を保存する
 * - updateBuyPriority: 購入優先順（整数、1が最優先）を保存する
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateStockPaths } from '@/lib/revalidate';
import {
  updateRosterSchema,
  updateRatingSchema,
  updateBuyPrioritySchema,
  type UpdateRosterInput,
  type UpdateRatingInput,
  type UpdateBuyPriorityInput,
} from '@/lib/schemas/roster';
import type { RosterCategory } from '@/lib/types/roster';

/**
 * ロースター分類を更新し、変更履歴を roster_history に記録する
 * 同じカテゴリへの変更は拒否する（無意味な履歴を防ぐ）
 */
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

  // Database 型の導入により roster_category は RosterCategory と同じリテラル型で返るため、キャスト不要
  const fromCategory: RosterCategory | null = stock.roster_category;

  // 同じカテゴリへの変更は無視
  if (fromCategory === parsed.data.category) {
    return { success: false, error: '同じカテゴリです' };
  }

  // stocks テーブルの roster_category を更新（RLS と二重で所有権を担保）
  const { error: updateError } = await supabase
    .from('stocks')
    .update({ roster_category: parsed.data.category })
    .eq('id', parsed.data.stock_id)
    .eq('user_id', user.id);

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
    // 履歴の書き込みに失敗しても分類自体は更新済み（方針: 監査ログ系は console.error + 続行）
    console.error('roster_history insert failed:', historyError);
  }

  revalidateStockPaths(parsed.data.stock_id);
  return { success: true };
}

/** 銘柄の5段階評価を更新する（stocks.rating カラム） */
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
    .eq('id', parsed.data.stock_id)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: '評価の更新に失敗しました' };
  }

  revalidateStockPaths(parsed.data.stock_id);
  return { success: true };
}

/** 銘柄の購入優先順を更新する（stocks.buy_priority カラム、null で未設定） */
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
    .eq('id', parsed.data.stock_id)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: '優先順の更新に失敗しました' };
  }

  revalidateStockPaths(parsed.data.stock_id);
  return { success: true };
}
