/**
 * 売買取引履歴の Server Actions
 *
 * - listTransactions: 銘柄の取引履歴を取得（約定日降順）
 * - createTransaction / updateTransaction / deleteTransaction: CRUD
 *
 * すべて Zod 検証 → 認証 → user_id を明示付与（RLS と二重で所有権担保）。
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateStockPaths } from '@/lib/revalidate';
import {
  createTransactionSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from '@/lib/schemas/transactions';
import type { TransactionRow } from '@/lib/types/transactions';

/** 取引履歴を約定日降順（同日は登録順の降順）で取得する */
export async function listTransactions(
  stockId: string,
): Promise<{ data: TransactionRow[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [] };

  const { data } = await supabase
    .from('transactions')
    .select('id, stock_id, transaction_type, trade_date, quantity, unit_price, fee, memo')
    .eq('stock_id', stockId)
    .eq('user_id', user.id)
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false });

  // NUMERIC は文字列で返ることがあるため number へ正規化する
  const rows: TransactionRow[] = (data ?? []).map((r) => ({
    id: r.id,
    stock_id: r.stock_id,
    transaction_type: r.transaction_type,
    trade_date: r.trade_date,
    quantity: Number(r.quantity),
    unit_price: Number(r.unit_price),
    fee: Number(r.fee),
    memo: r.memo,
  }));

  return { data: rows };
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<{ success: boolean; error?: string }> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  // 取引先の銘柄が自分のものか確認（他人の stock_id を指す行の作成を防ぐ多層防御）
  const { data: owned } = await supabase
    .from('stocks')
    .select('id')
    .eq('id', parsed.data.stock_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!owned) return { success: false, error: '対象の銘柄が見つかりません' };

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
  input: UpdateTransactionInput,
): Promise<{ success: boolean; error?: string }> {
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

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
    .select('id');

  if (error) return { success: false, error: '取引の更新に失敗しました' };
  if (!updated || updated.length === 0) {
    return { success: false, error: '対象の取引が見つかりませんでした' };
  }

  revalidateStockPaths(parsed.data.stock_id);
  return { success: true };
}

export async function deleteTransaction(
  id: string,
  stockId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { success: false, error: '取引の削除に失敗しました' };

  revalidateStockPaths(stockId);
  return { success: true };
}
