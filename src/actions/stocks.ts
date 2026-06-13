'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  createStockSchema,
  type CreateStockInput,
  updateStockSchema,
  type UpdateStockInput,
} from '@/lib/schemas/stocks';
import { PARAMETER_DEFAULTS } from '@/lib/schemas/parameters';

export async function createStock(
  data: CreateStockInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = createStockSchema.safeParse(data);
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

  const { data: newStock, error } = await supabase.from('stocks').insert({
    user_id: user.id,
    stock_code: parsed.data.stock_code,
    company_name: parsed.data.company_name,
    market: parsed.data.market || null,
    sector: parsed.data.sector || null,
    business_segment: parsed.data.business_segment || null,
  }).select('id').single();

  if (error?.code === '23505') {
    return { success: false, error: 'この銘柄コードは既に登録されています' };
  }
  if (error || !newStock) {
    return { success: false, error: '銘柄の登録に失敗しました' };
  }

  // パラメータをデフォルト値で自動作成（ユーザーは後から変更可能）
  // デフォルト値の唯一の真実の源は PARAMETER_DEFAULTS（schemas/parameters.ts）。
  // ここにハードコードすると DB デフォルト・UI 表示と食い違い、
  // 銘柄の作成経路によって理論株価が変わるバグになる（過去に cap_multiplier 20 vs 10 で発生）
  const { error: paramsError } = await supabase.from('parameters').insert({
    // user_id は NOT NULL かつ RLS の WITH CHECK 対象。
    // 従来は欠落しており insert が常に失敗していた（Database 型の導入で発覚）
    user_id: user.id,
    stock_id: newStock.id,
    ...PARAMETER_DEFAULTS,
  });
  if (paramsError) {
    // パラメータが無いと理論株価が計算できないため、失敗を握り潰さず通知する
    console.error('parameters insert failed:', paramsError);
    return {
      success: false,
      error: '銘柄は登録されましたが、パラメータの初期化に失敗しました。パラメータタブで保存し直してください。',
    };
  }

  revalidatePath('/stocks');
  return { success: true };
}

export async function updateStock(
  data: UpdateStockInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = updateStockSchema.safeParse(data);
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
    .from('stocks')
    .update({
      stock_code: parsed.data.stock_code,
      company_name: parsed.data.company_name,
      market: parsed.data.market || null,
      sector: parsed.data.sector || null,
      business_segment: parsed.data.business_segment || null,
    })
    .eq('id', parsed.data.id)
    .select('id');

  if (error?.code === '23505') {
    return { success: false, error: 'この銘柄コードは既に登録されています' };
  }
  if (error) {
    return { success: false, error: '銘柄情報の更新に失敗しました' };
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: '銘柄が見つかりませんでした' };
  }

  revalidatePath('/stocks');
  return { success: true };
}

export async function deleteStock(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) {
    return { success: false, error: '無効なIDです' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  const { error } = await supabase.from('stocks').delete().eq('id', id);

  if (error) {
    return { success: false, error: '銘柄の削除に失敗しました' };
  }

  revalidatePath('/stocks');
  return { success: true };
}
