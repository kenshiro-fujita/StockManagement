/**
 * 売買取引履歴の Server Actions
 *
 * - listTransactions: 銘柄の取引履歴を取得（約定日降順）
 * - createTransaction / updateTransaction / deleteTransaction: CRUD
 *
 * すべて Zod 検証 → 認証 → user_id を明示付与（RLS と二重で所有権担保）。
 */
'use server';

import { getAuthenticatedContext } from '@/lib/supabase/auth';
import { checkStockOwnership } from '@/lib/supabase/ownership';
import { revalidateStockPaths } from '@/lib/revalidate';
import { idSchema, stockIdSchema } from '@/lib/schemas/common';
import {
  createTransactionSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from '@/lib/schemas/transactions';
import type { TransactionRow } from '@/lib/types/transactions';
import type { ActionResult } from '@/lib/types/action';
import type { Tables } from '@/lib/types/database';

/** Supabase の NUMERIC を画面が扱う number へ正規化します。 */
function toTransactionRow(
  row: Pick<
    Tables<'transactions'>,
    | 'id'
    | 'stock_id'
    | 'transaction_type'
    | 'trade_date'
    | 'quantity'
    | 'unit_price'
    | 'fee'
    | 'memo'
  >
): TransactionRow {
  return {
    id: row.id,
    stock_id: row.stock_id,
    transaction_type: row.transaction_type,
    trade_date: row.trade_date,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    fee: Number(row.fee),
    memo: row.memo,
  };
}

/** 取引履歴を約定日降順（同日は登録順の降順）で取得する */
export async function listTransactions(
  stockId: string
): Promise<ActionResult<TransactionRow[]>> {
  if (!stockIdSchema.safeParse(stockId).success) {
    return { success: false, error: '無効な銘柄IDです' };
  }

  const context = await getAuthenticatedContext();
  if (!context) return { success: false, error: '認証が必要です' };
  const { supabase, user } = context;

  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, stock_id, transaction_type, trade_date, quantity, unit_price, fee, memo'
    )
    .eq('stock_id', stockId)
    .eq('user_id', user.id)
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listTransactions failed:', error);
    return { success: false, error: '取引履歴の取得に失敗しました' };
  }

  return { success: true, data: (data ?? []).map(toTransactionRow) };
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<ActionResult> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります',
    };
  }

  const context = await getAuthenticatedContext();
  if (!context) return { success: false, error: '認証が必要です' };
  const { supabase, user } = context;

  // 取引先の銘柄が自分のものか確認（他人の stock_id を指す行の作成を防ぐ多層防御）
  const ownership = await checkStockOwnership(
    supabase,
    user.id,
    parsed.data.stock_id
  );
  if (ownership === 'error') {
    return { success: false, error: '銘柄情報の確認に失敗しました' };
  }
  if (ownership === 'not_found') {
    return { success: false, error: '対象の銘柄が見つかりません' };
  }

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    stock_id: parsed.data.stock_id,
    transaction_type: parsed.data.transaction_type,
    trade_date: parsed.data.trade_date,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    fee: parsed.data.fee,
    memo: parsed.data.memo ?? null,
  });

  if (error) return { success: false, error: '取引の保存に失敗しました' };

  revalidateStockPaths(parsed.data.stock_id);
  return { success: true };
}

export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<ActionResult> {
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります',
    };
  }

  const context = await getAuthenticatedContext();
  if (!context) return { success: false, error: '認証が必要です' };
  const { supabase, user } = context;

  const { data: updated, error } = await supabase
    .from('transactions')
    .update({
      transaction_type: parsed.data.transaction_type,
      trade_date: parsed.data.trade_date,
      quantity: parsed.data.quantity,
      unit_price: parsed.data.unit_price,
      fee: parsed.data.fee,
      memo: parsed.data.memo ?? null,
    })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    // フォームの銘柄IDと取引の親銘柄を一致させ、別銘柄の再検証を防ぎます。
    .eq('stock_id', parsed.data.stock_id)
    .select('id, stock_id');

  if (error) return { success: false, error: '取引の更新に失敗しました' };
  const updatedTransaction = updated?.[0];
  if (!updatedTransaction) {
    return { success: false, error: '対象の取引が見つかりませんでした' };
  }

  revalidateStockPaths(updatedTransaction.stock_id);
  return { success: true };
}

export async function deleteTransaction(
  id: string,
  stockId: string
): Promise<ActionResult> {
  if (
    !idSchema.safeParse(id).success ||
    !stockIdSchema.safeParse(stockId).success
  ) {
    return { success: false, error: '入力内容に誤りがあります' };
  }

  const context = await getAuthenticatedContext();
  if (!context) return { success: false, error: '認証が必要です' };
  const { supabase, user } = context;

  const { data: deleted, error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('stock_id', stockId)
    .select('id, stock_id');

  if (error) return { success: false, error: '取引の削除に失敗しました' };
  const deletedTransaction = deleted?.[0];
  if (!deletedTransaction) {
    return { success: false, error: '対象の取引が見つかりませんでした' };
  }

  revalidateStockPaths(deletedTransaction.stock_id);
  return { success: true };
}
