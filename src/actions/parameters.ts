/**
 * 銘柄ごとの評価パラメータを取得・初期化・更新する Server Actions です。
 *
 * デフォルト値は schema の定数だけを参照し、親銘柄の所有権を確認してから
 * ユーザー別のパラメータへアクセスします。
 */
'use server';

import { getAuthenticatedContext } from '@/lib/supabase/auth';
import { checkStockOwnership } from '@/lib/supabase/ownership';
import { revalidateStockPaths } from '@/lib/revalidate';
import { stockIdSchema } from '@/lib/schemas/common';
import {
  updateParametersSchema,
  PARAMETER_DEFAULTS,
  type UpdateParametersInput,
} from '@/lib/schemas/parameters';
import type { ParametersRow } from '@/lib/types/parameters';
import type { Tables } from '@/lib/types/database';
import type { ActionResult } from '@/lib/types/action';

/** パラメータ取得で明示するカラムを一箇所に固定します。 */
const PARAMETER_COLUMNS =
  'id, stock_id, discount_rate, growth_rate, tax_rate, cap_multiplier' as const;

export async function getOrCreateParameters(
  stockId: string
): Promise<ActionResult<ParametersRow>> {
  if (!stockIdSchema.safeParse(stockId).success) {
    return { success: false, error: '無効な銘柄IDです' };
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
    return { success: false, error: '対象の銘柄が見つかりませんでした' };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('parameters')
    .select(PARAMETER_COLUMNS)
    .eq('stock_id', stockId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: 'パラメータの取得に失敗しました' };
  }

  if (existing) {
    return { success: true, data: toParametersRow(existing) };
  }

  // デフォルト値は PARAMETER_DEFAULTS（単一の真実の源）を明示的に渡す。
  // DB カラムデフォルト任せにすると、将来 DB 側がズレたとき気付けない
  const { data: created, error } = await supabase
    .from('parameters')
    .insert({ user_id: user.id, stock_id: stockId, ...PARAMETER_DEFAULTS })
    .select(PARAMETER_COLUMNS)
    .single();

  if (error) {
    // UNIQUE constraint violation (concurrent tab race) — retry SELECT
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('parameters')
        .select(PARAMETER_COLUMNS)
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
): Promise<ActionResult<ParametersRow>> {
  if (!stockIdSchema.safeParse(stockId).success) {
    return { success: false, error: '無効な銘柄IDです' };
  }

  const parsed = updateParametersSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: '入力内容に誤りがあります' };
  }
  // URL/親コンポーネント由来のIDとフォーム内のIDを一致させ、別銘柄への誤更新を防ぎます。
  if (parsed.data.stock_id !== stockId) {
    return { success: false, error: '銘柄IDが一致しません' };
  }

  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }
  const { supabase, user } = context;

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
    .select(PARAMETER_COLUMNS);

  if (error) {
    return { success: false, error: 'パラメータの更新に失敗しました' };
  }

  const updatedParameters = updated?.[0];
  if (!updatedParameters) {
    return { success: false, error: '対象のパラメータが見つかりませんでした' };
  }

  revalidateStockPaths(stockId);
  return { success: true, data: toParametersRow(updatedParameters) };
}

/** Convert Supabase NUMERIC (string) to JavaScript number */
function toParametersRow(
  // Database 型の導入によりクエリ結果が型付くため、SELECT したカラムの Pick で受ける
  row: Pick<
    Tables<'parameters'>,
    | 'id'
    | 'stock_id'
    | 'discount_rate'
    | 'growth_rate'
    | 'tax_rate'
    | 'cap_multiplier'
  >
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
