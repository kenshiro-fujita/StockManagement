/**
 * 理論株価計算に必要な銘柄別パラメータです。
 *
 * DB型から導出して、マイグレーションとアプリ型の乖離を防ぎます。
 */
import type { Tables } from '@/lib/types/database';

export type ParametersRow = Pick<
  Tables<'parameters'>,
  | 'id'
  | 'stock_id'
  | 'discount_rate'
  | 'growth_rate'
  | 'tax_rate'
  | 'cap_multiplier'
>;
