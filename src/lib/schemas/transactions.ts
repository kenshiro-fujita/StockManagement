import { z } from 'zod';

/** 取引種別の選択肢（UI のセレクト用） */
export const TRANSACTION_TYPE_OPTIONS = [
  { value: 'buy', label: '買い' },
  { value: 'sell', label: '売り' },
] as const;

/** 約定日は妥当な範囲（過去〜未来1年程度）に収める。YYYY-MM-DD 文字列 */
const tradeDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '約定日は日付形式で入力してください')
  .refine((s) => Number.isFinite(Date.parse(`${s}T00:00:00Z`)), '有効な日付を入力してください');

export const createTransactionSchema = z.object({
  stock_id: z.uuid('銘柄IDが不正です'),
  transaction_type: z.enum(['buy', 'sell'], { error: '取引種別を選択してください' }),
  trade_date: tradeDateSchema,
  quantity: z
    .number({ error: '株数を入力してください' })
    .positive('株数は1以上で入力してください'),
  unit_price: z
    .number({ error: '単価を入力してください' })
    .nonnegative('単価は0以上で入力してください'),
  fee: z.number().nonnegative('手数料は0以上で入力してください').default(0),
  memo: z.string().max(500, 'メモは500文字以内で入力してください').optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.extend({
  id: z.uuid('取引IDが不正です'),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
