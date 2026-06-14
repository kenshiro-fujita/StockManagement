import type { Tables } from '@/lib/types/database';

/** 取引履歴の行（UI で扱う形）。NUMERIC は number に正規化済みとして扱う */
export type TransactionRow = Pick<
  Tables<'transactions'>,
  | 'id'
  | 'stock_id'
  | 'transaction_type'
  | 'trade_date'
  | 'quantity'
  | 'unit_price'
  | 'fee'
  | 'memo'
>;
