import { z } from 'zod';

/** Default parameter values with investment-theory justifications */
export const PARAMETER_DEFAULTS = {
  discount_rate: 0.08,
  growth_rate: 0.02,
  tax_rate: 0.3,
  cap_multiplier: 10,
} as const;

/** Metadata for each parameter: label, description (justification), unit, range, step */
export const PARAMETER_META = {
  discount_rate: {
    label: '割引率 (r)',
    description: '日本株の長期平均リスクプレミアム（約5%）+ リスクフリーレート（約3%）',
    unit: '%',
    min: 0.001,
    max: 0.3,
    step: 0.001,
    displayMultiplier: 100,
  },
  growth_rate: {
    label: '永久成長率 (g)',
    description: '日本の長期名目GDP成長率',
    unit: '%',
    min: 0,
    max: 0.15,
    step: 0.001,
    displayMultiplier: 100,
  },
  tax_rate: {
    label: '実効税率',
    description: '日本の法定実効税率の近似値',
    unit: '%',
    min: 0,
    max: 1.0,
    step: 0.01,
    displayMultiplier: 100,
  },
  cap_multiplier: {
    label: '上限倍率',
    description: '事業価値算出時の営業利益倍率上限（山口揚平氏の手法）',
    unit: '倍',
    min: 1,
    max: 100,
    step: 1,
    displayMultiplier: 1,
  },
} as const;

export type ParameterKey = keyof typeof PARAMETER_META;

export const PARAMETER_KEYS = Object.keys(PARAMETER_META) as ParameterKey[];

export const updateParametersSchema = z
  .object({
    stock_id: z.uuid({ error: '無効な銘柄IDです' }),
    discount_rate: z
      .number()
      .min(0.001, '割引率は0.1%以上で入力してください')
      .max(0.3, '割引率は30%以下で入力してください'),
    growth_rate: z
      .number()
      .min(0, '成長率は0%以上で入力してください')
      .max(0.15, '成長率は15%以下で入力してください'),
    tax_rate: z
      .number()
      .min(0, '実効税率は0%以上で入力してください')
      .max(1.0, '実効税率は100%以下で入力してください'),
    cap_multiplier: z
      .number()
      .min(1, '上限倍率は1以上で入力してください')
      .max(100, '上限倍率は100以下で入力してください'),
    // 6年目当期純利益予測（円）。成長込理論株価の算出に使う任意入力
    projected_net_income: z.number().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discount_rate <= data.growth_rate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '割引率は成長率より大きい値を設定してください（r > g）',
        path: ['discount_rate'],
      });
    }
  });

export type UpdateParametersInput = z.infer<typeof updateParametersSchema>;
