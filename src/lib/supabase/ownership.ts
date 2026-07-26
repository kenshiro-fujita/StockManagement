/**
 * ユーザー所有の銘柄を参照する処理の認可判定を共通化します。
 *
 * financial_data などの子テーブルへ自分の user_id で書き込めても、stock_id が
 * 他ユーザー所有なら整合性を壊せます。RLS に加えて親銘柄の所有権を明示確認します。
 */
import type { ServerSupabaseClient } from '@/lib/supabase/auth';
import type { Tables } from '@/lib/types/database';

/** 所有権確認の結果です。DB 障害と対象なしを混同しないよう3状態で表します。 */
export type StockOwnershipResult = 'owned' | 'not_found' | 'error';

/** EDINET 取込の親子整合性確認に必要な最小限の銘柄情報です。 */
export type OwnedStockIdentity = Pick<Tables<'stocks'>, 'id' | 'stock_code'>;

/** 銘柄情報付きの所有権確認結果です。 */
export type OwnedStockLookupResult =
  | { status: 'owned'; stock: OwnedStockIdentity }
  | { status: 'not_found' }
  | { status: 'error' };

/** 指定したユーザーが所有する銘柄の識別情報を取得します。 */
export async function findOwnedStock(
  supabase: ServerSupabaseClient,
  userId: string,
  stockId: string
): Promise<OwnedStockLookupResult> {
  const { data, error } = await supabase
    .from('stocks')
    .select('id, stock_code')
    .eq('id', stockId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { status: 'error' };
  }

  return data ? { status: 'owned', stock: data } : { status: 'not_found' };
}

/** 指定した銘柄が現在のユーザーに属するかを確認します。 */
export async function checkStockOwnership(
  supabase: ServerSupabaseClient,
  userId: string,
  stockId: string
): Promise<StockOwnershipResult> {
  const result = await findOwnedStock(supabase, userId, stockId);
  return result.status;
}
