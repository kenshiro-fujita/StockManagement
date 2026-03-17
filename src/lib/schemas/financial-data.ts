import { z } from 'zod';

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
  'hundred_million',
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
  .transform((val) => (val === '' ? undefined : val))
  .pipe(
    z
      .string()
      .regex(/^-?[\d,]+\.?\d*$/, '有効な数値を入力してください')
      .transform((val) => Number(val.replace(/,/g, '')))
      .pipe(z.number().finite('有効な数値を入力してください'))
      .optional()
  );

export const createFinancialDataSchema = z.object({
  stock_id: z.uuid({ error: '無効な銘柄IDです' }),

  // Period attributes
  fiscal_year: z
    .number()
    .int('年度は整数で入力してください')
    .min(1900, '1900年以降を指定してください')
    .max(2100, '2100年以前を指定してください'),
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

  // Metadata
  input_unit: z.enum(INPUT_UNIT_OPTIONS, {
    error: '有効な単位を選択してください',
  }),
});

export type CreateFinancialDataInput = z.infer<
  typeof createFinancialDataSchema
>;
