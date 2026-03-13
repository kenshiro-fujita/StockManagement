'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createStockSchema, type CreateStockInput } from '@/lib/schemas/stocks';

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
