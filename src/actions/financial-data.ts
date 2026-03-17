'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  createFinancialDataSchema,
  type CreateFinancialDataInput,
} from '@/lib/schemas/financial-data';
import { toYen, type InputUnit } from '@/lib/utils/unit-conversion';

export async function createFinancialData(
  data: CreateFinancialDataInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = createFinancialDataSchema.safeParse(data);
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

  const unit = parsed.data.input_unit as InputUnit;

  // Unit conversion fields (convert to yen)
  const convertFields = [
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

  // Fields that are NOT subject to unit conversion
  // shares_outstanding: stored as share count
  // current_stock_price: always in yen

  const converted: Record<string, number | null> = {};
  for (const field of convertFields) {
    const val = parsed.data[field];
    converted[field] = val != null ? toYen(val, unit) : null;
  }

  const { error } = await supabase.from('financial_data').insert({
    user_id: user.id,
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
