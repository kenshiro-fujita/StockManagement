'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  createStockSchema,
  type CreateStockInput,
  updateStockSchema,
  type UpdateStockInput,
} from '@/lib/schemas/stocks';

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

  const { error } = await supabase.from('stocks').insert({
    user_id: user.id,
    stock_code: parsed.data.stock_code,
    company_name: parsed.data.company_name,
    market: parsed.data.market || null,
    sector: parsed.data.sector || null,
    business_segment: parsed.data.business_segment || null,
  });

  if (error?.code === '23505') {
    return { success: false, error: 'この銘柄コードは既に登録されています' };
  }
  if (error) {
    return { success: false, error: '銘柄の登録に失敗しました' };
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
