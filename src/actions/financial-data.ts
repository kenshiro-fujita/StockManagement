'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  createFinancialDataSchema,
  type CreateFinancialDataInput,
} from '@/lib/schemas/financial-data';
import { toYen, type InputUnit } from '@/lib/utils/unit-conversion';

// Fields subject to unit conversion (all amount fields except shares/price)
const CONVERT_FIELDS = [
  'revenue',
  'operating_income',
  'net_income',
  'total_assets',
  'equity',
  'interest_bearing_debt',
  'operating_cf',
  'investing_cf',
  'interest_expense',
] as const;

/** Shared parse + convert + auth logic for create and update */
async function parseAndConvert(data: CreateFinancialDataInput) {
  const parsed = createFinancialDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: '入力内容に誤りがあります' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: '認証が必要です' };
  }

  const unit = parsed.data.input_unit as InputUnit;

  const converted: Record<string, number | null> = {};
  for (const field of CONVERT_FIELDS) {
    const val = parsed.data[field];
    converted[field] = val != null ? toYen(val, unit) : null;
  }

  const row = {
    stock_id: parsed.data.stock_id,
    fiscal_year: parsed.data.fiscal_year,
    fiscal_quarter: parsed.data.fiscal_quarter,
    consolidation_type: parsed.data.consolidation_type,
    revenue: converted.revenue,
    operating_income: converted.operating_income,
    net_income: converted.net_income,
    total_assets: converted.total_assets,
    equity: converted.equity,
    interest_bearing_debt: converted.interest_bearing_debt,
    operating_cf: converted.operating_cf,
    investing_cf: converted.investing_cf,
    shares_outstanding: parsed.data.shares_outstanding ?? null,
    interest_expense: converted.interest_expense,
    current_stock_price: parsed.data.current_stock_price ?? null,
    input_unit: parsed.data.input_unit,
  };

  return { ok: true as const, supabase, user, parsed, row };
}

export async function createFinancialData(
  data: CreateFinancialDataInput
): Promise<{ success: boolean; error?: string }> {
  const result = await parseAndConvert(data);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { supabase, user, parsed, row } = result;

  const { error } = await supabase.from('financial_data').insert({
    user_id: user.id,
    ...row,
  });

  if (error?.code === '23505') {
    return {
      success: false,
      error: 'この期間のデータは既に登録されています。編集画面から修正してください',
    };
  }
  if (error) {
    return { success: false, error: '財務データの保存に失敗しました' };
  }

  revalidatePath(`/stocks/${parsed.data.stock_id}`);
  return { success: true };
}

export async function updateFinancialData(
  id: string,
  data: CreateFinancialDataInput
): Promise<{ success: boolean; error?: string }> {
  const result = await parseAndConvert(data);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { supabase, user, parsed, row } = result;

  const { data: updated, error } = await supabase
    .from('financial_data')
    .update(row)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id');

  if (error) {
    return { success: false, error: '財務データの更新に失敗しました' };
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: '対象の財務データが見つかりませんでした' };
  }

  revalidatePath(`/stocks/${parsed.data.stock_id}`);
  return { success: true };
}

/** 財務データを削除する */
export async function deleteFinancialData(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  const { error } = await supabase
    .from('financial_data')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: '財務データの削除に失敗しました' };
  }

  revalidatePath('/stocks');
  return { success: true };
}
