/**
 * 財務データの CRUD Server Actions
 *
 * - createFinancialData: 新規登録（Zod バリデーション → 単位変換 → DB insert）
 * - updateFinancialData: 更新（同上 → DB update）
 * - deleteFinancialData: 削除
 * - addEmptyFinancialYear: グリッドからの空行追加（Zod を経由しない直接 insert）
 *
 * 金額フィールドはユーザーが選択した入力単位（百万円等）で入力され、
 * 保存時に円に変換してDBに格納する。
 */
'use server';

import { getAuthenticatedContext } from '@/lib/supabase/auth';
import { checkStockOwnership } from '@/lib/supabase/ownership';
import { revalidateStockPaths } from '@/lib/revalidate';
import {
  fiscalYearSchema,
  idSchema,
  stockIdSchema,
} from '@/lib/schemas/common';
import {
  createFinancialDataSchema,
  type CreateFinancialDataInput,
} from '@/lib/schemas/financial-data';
import type { ActionResult } from '@/lib/types/action';
import { toYen, type InputUnit } from '@/lib/utils/unit-conversion';

/** 任意入力の金額を、未入力の意味を保ったまま円へ変換します。 */
function optionalAmountToYen(
  value: number | undefined,
  unit: InputUnit
): number | null {
  return value == null ? null : toYen(value, unit);
}

/**
 * create/update 共通の前処理: Zod バリデーション → 認証チェック → 単位変換
 * 成功時は supabase クライアント、ユーザー、変換済み行データを返す
 */
async function parseAndConvert(data: CreateFinancialDataInput) {
  const parsed = createFinancialDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: '入力内容に誤りがあります' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { ok: false as const, error: '認証が必要です' };
  }
  const { supabase, user } = context;

  const ownership = await checkStockOwnership(
    supabase,
    user.id,
    parsed.data.stock_id
  );
  if (ownership === 'error') {
    return { ok: false as const, error: '銘柄情報の確認に失敗しました' };
  }
  if (ownership === 'not_found') {
    return { ok: false as const, error: '対象の銘柄が見つかりません' };
  }

  const unit: InputUnit = parsed.data.input_unit;

  const row = {
    stock_id: parsed.data.stock_id,
    fiscal_year: parsed.data.fiscal_year,
    fiscal_quarter: parsed.data.fiscal_quarter,
    consolidation_type: parsed.data.consolidation_type,
    // 必須項目を直接変換すると、動的 Record と非 null 断言を介さず型を維持できます。
    revenue: toYen(parsed.data.revenue, unit),
    operating_income: toYen(parsed.data.operating_income, unit),
    net_income: toYen(parsed.data.net_income, unit),
    total_assets: toYen(parsed.data.total_assets, unit),
    equity: toYen(parsed.data.equity, unit),
    interest_bearing_debt: optionalAmountToYen(
      parsed.data.interest_bearing_debt,
      unit
    ),
    operating_cf: optionalAmountToYen(parsed.data.operating_cf, unit),
    investing_cf: optionalAmountToYen(parsed.data.investing_cf, unit),
    shares_outstanding: parsed.data.shares_outstanding ?? null,
    interest_expense: optionalAmountToYen(parsed.data.interest_expense, unit),
    current_stock_price: parsed.data.current_stock_price ?? null,
    cash_and_equivalents: optionalAmountToYen(
      parsed.data.cash_and_equivalents,
      unit
    ),
    current_assets: optionalAmountToYen(parsed.data.current_assets, unit),
    investments_and_other_assets: optionalAmountToYen(
      parsed.data.investments_and_other_assets,
      unit
    ),
    current_liabilities: optionalAmountToYen(
      parsed.data.current_liabilities,
      unit
    ),
    non_current_liabilities: optionalAmountToYen(
      parsed.data.non_current_liabilities,
      unit
    ),
    shareholders_equity: optionalAmountToYen(
      parsed.data.shareholders_equity,
      unit
    ),
    // β値は倍率なので、金額の入力単位による変換対象にはしません。
    beta: parsed.data.beta ?? null,
    input_unit: parsed.data.input_unit,
  };

  return {
    ok: true as const,
    supabase,
    user,
    stockId: parsed.data.stock_id,
    row,
  };
}

export async function createFinancialData(
  data: CreateFinancialDataInput
): Promise<ActionResult> {
  const result = await parseAndConvert(data);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { supabase, user, stockId, row } = result;

  const { error } = await supabase.from('financial_data').insert({
    user_id: user.id,
    ...row,
  });

  if (error?.code === '23505') {
    return {
      success: false,
      error:
        'この期間のデータは既に登録されています。編集画面から修正してください',
    };
  }
  if (error) {
    return { success: false, error: '財務データの保存に失敗しました' };
  }

  revalidateStockPaths(stockId);
  return { success: true };
}

export async function updateFinancialData(
  id: string,
  data: CreateFinancialDataInput
): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) {
    return { success: false, error: '無効なIDです' };
  }

  const result = await parseAndConvert(data);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { supabase, user, stockId, row } = result;

  const { data: updated, error } = await supabase
    .from('financial_data')
    .update(row)
    .eq('id', id)
    .eq('user_id', user.id)
    // 更新対象の親銘柄も一致させ、別銘柄への行移動とキャッシュ不整合を防ぎます。
    .eq('stock_id', stockId)
    .select('id');

  if (error) {
    return { success: false, error: '財務データの更新に失敗しました' };
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: '対象の財務データが見つかりませんでした' };
  }

  revalidateStockPaths(stockId);
  return { success: true };
}

/** 空の財務データ行を新規追加する（グリッドで年度追加用） */
export async function addEmptyFinancialYear(
  stockId: string,
  fiscalYear: number
): Promise<ActionResult> {
  if (
    !stockIdSchema.safeParse(stockId).success ||
    !fiscalYearSchema.safeParse(fiscalYear).success
  ) {
    return { success: false, error: '入力内容に誤りがあります' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase, user } = context;

  const ownership = await checkStockOwnership(supabase, user.id, stockId);
  if (ownership === 'error') {
    return { success: false, error: '銘柄情報の確認に失敗しました' };
  }
  if (ownership === 'not_found') {
    return { success: false, error: '対象の銘柄が見つかりません' };
  }

  // 重複チェック
  const { data: existing, error: lookupError } = await supabase
    .from('financial_data')
    .select('id')
    .eq('stock_id', stockId)
    .eq('user_id', user.id)
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_quarter', 'FY')
    .eq('consolidation_type', 'consolidated')
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: '年度データの確認に失敗しました' };
  }
  if (existing) {
    return {
      success: false,
      error: `${fiscalYear}年度のデータは既に存在します`,
    };
  }

  const { error } = await supabase.from('financial_data').insert({
    user_id: user.id,
    stock_id: stockId,
    fiscal_year: fiscalYear,
    fiscal_quarter: 'FY',
    consolidation_type: 'consolidated',
    revenue: 0,
    operating_income: 0,
    net_income: 0,
    total_assets: 0,
    equity: 0,
    input_unit: 'yen',
  });

  if (error?.code === '23505') {
    return {
      success: false,
      error: `${fiscalYear}年度のデータは既に存在します`,
    };
  }
  if (error) {
    return { success: false, error: '年度の追加に失敗しました' };
  }

  revalidateStockPaths(stockId);
  return { success: true };
}

/** 財務データを削除する */
export async function deleteFinancialData(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) {
    return { success: false, error: '無効なIDです' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase, user } = context;

  // 削除前に stock_id を取得しておく（削除後では引けず、詳細ページの revalidate ができない）
  const { data: target, error: lookupError } = await supabase
    .from('financial_data')
    .select('stock_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: '財務データの確認に失敗しました' };
  }
  if (!target) {
    return { success: false, error: '対象の財務データが見つかりませんでした' };
  }

  const { data: deleted, error } = await supabase
    .from('financial_data')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id');

  if (error) {
    return { success: false, error: '財務データの削除に失敗しました' };
  }
  if (!deleted || deleted.length === 0) {
    return { success: false, error: '対象の財務データが見つかりませんでした' };
  }

  revalidateStockPaths(target.stock_id);
  return { success: true };
}
