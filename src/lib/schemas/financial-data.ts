/**
 * 財務データ入力の期間・金額・単位を検証し、保存前の数値へ変換します。
 *
 * Server Action とフォームが同じ制約を使うことで、クライアント表示とDB境界の
 * バリデーションが別々に変化することを防ぎます。
 */
import { z } from 'zod';
import { fiscalYearSchema, stockIdSchema } from '@/lib/schemas/common';

export const FISCAL_QUARTER_OPTIONS = ['Q1', 'Q2', 'Q3', 'Q4', 'FY'] as const;

export const FISCAL_QUARTER_LABELS: Record<string, string> = {
  Q1: '第1四半期',
  Q2: '第2四半期',
  Q3: '第3四半期',
  Q4: '第4四半期',
  FY: '通期',
};

export const CONSOLIDATION_TYPE_OPTIONS = [
  'consolidated',
  'standalone',
] as const;

export const CONSOLIDATION_TYPE_LABELS: Record<string, string> = {
  consolidated: '連結',
  standalone: '単体',
};

export const INPUT_UNIT_OPTIONS = [
  'yen',
  'thousand',
  'million',
  'billion',
] as const;

const requiredAmount = z
  .string()
  .trim()
  .min(1, '値を入力してください')
  .regex(/^-?[\d,]+\.?\d*$/, '有効な数値を入力してください')
  .transform((val) => Number(val.replace(/,/g, '')))
  .pipe(z.number().finite('有効な数値を入力してください'));

const optionalAmount = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (value == null || value === '') return undefined;
    if (!/^-?[\d,]+\.?\d*$/.test(value)) {
      context.addIssue({
        code: 'custom',
        message: '有効な数値を入力してください',
      });
      return z.NEVER;
    }

    const parsed = Number(value.replace(/,/g, ''));
    if (!Number.isFinite(parsed)) {
      context.addIssue({
        code: 'custom',
        message: '有効な数値を入力してください',
      });
      return z.NEVER;
    }
    return parsed;
  });

export const createFinancialDataSchema = z
  .object({
    stock_id: stockIdSchema,

    // Period attributes
    fiscal_year: fiscalYearSchema,
    fiscal_quarter: z.enum(FISCAL_QUARTER_OPTIONS, {
      error: '有効な四半期を選択してください',
    }),
    consolidation_type: z.enum(CONSOLIDATION_TYPE_OPTIONS, {
      error: '連結/単体を選択してください',
    }),

    // Required fields (user input values, before unit conversion)
    revenue: requiredAmount,
    operating_income: requiredAmount,
    net_income: requiredAmount,
    total_assets: requiredAmount,
    equity: requiredAmount,

    // Optional fields
    interest_bearing_debt: optionalAmount,
    operating_cf: optionalAmount,
    investing_cf: optionalAmount,
    shares_outstanding: optionalAmount,
    interest_expense: optionalAmount,
    current_stock_price: optionalAmount,
    cash_and_equivalents: optionalAmount,
    current_assets: optionalAmount,
    investments_and_other_assets: optionalAmount,
    current_liabilities: optionalAmount,
    non_current_liabilities: optionalAmount,
    shareholders_equity: optionalAmount,
    beta: optionalAmount,

    // Metadata
    input_unit: z.enum(INPUT_UNIT_OPTIONS, {
      error: '有効な単位を選択してください',
    }),
  })
  .superRefine((data, ctx) => {
    // Revenue should not be negative (unlike operating_income/net_income which can be negative for losses)
    if (data.revenue < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '売上高は0以上の値を入力してください',
        path: ['revenue'],
      });
    }
    // Total assets must be positive
    if (data.total_assets <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '総資産は0より大きい値を入力してください',
        path: ['total_assets'],
      });
    }
    // Equity should not exceed total assets (warning-level: possible but unusual)
    if (data.equity > data.total_assets) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '自己資本が総資産を超えています。入力値を確認してください',
        path: ['equity'],
      });
    }
  });

/** Server Action が実際に受け取る、数値文字列を変換する前の入力型です。 */
export type CreateFinancialDataInput = z.input<
  typeof createFinancialDataSchema
>;
