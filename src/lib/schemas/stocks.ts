import { z } from 'zod';

export const createStockSchema = z.object({
  // 証券コードは英数字のみ許可する。
  // 4桁数字に限定しないのは、2024年以降の新規上場で英字入りコード（例「130A」）が
  // 使われるため。文字種だけ制限して想定外入力（記号等）を弾く
  stock_code: z
    .string()
    .trim()
    .min(1, '銘柄コードを入力してください')
    .max(10, '銘柄コードは10文字以内で入力してください')
    .regex(/^[0-9A-Za-z]+$/, '銘柄コードは英数字で入力してください'),
  company_name: z
    .string()
    .trim()
    .min(1, '企業名を入力してください')
    .max(100, '企業名は100文字以内で入力してください'),
  market: z.string().optional(),
  sector: z.string().optional(),
  business_segment: z.string().optional(),
});

export type CreateStockInput = z.infer<typeof createStockSchema>;

export const updateStockSchema = createStockSchema.extend({
  id: z.uuid({ error: '無効なIDです' }),
});

export type UpdateStockInput = z.infer<typeof updateStockSchema>;

export const MARKET_OPTIONS = [
  '東証プライム',
  '東証スタンダード',
  '東証グロース',
  '名証',
  '札証',
  '福証',
  'その他',
] as const;

export const SECTOR_OPTIONS = [
  '水産・農林業',
  '鉱業',
  '建設業',
  '食料品',
  '繊維製品',
  'パルプ・紙',
  '化学',
  '医薬品',
  '石油・石炭製品',
  'ゴム製品',
  'ガラス・土石製品',
  '鉄鋼',
  '非鉄金属',
  '金属製品',
  '機械',
  '電気機器',
  '輸送用機器',
  '精密機器',
  'その他製品',
  '電気・ガス業',
  '陸運業',
  '海運業',
  '空運業',
  '倉庫・運輸関連業',
  '情報・通信業',
  '卸売業',
  '小売業',
  '銀行業',
  '証券、商品先物取引業',
  '保険業',
  'その他金融業',
  '不動産業',
  'サービス業',
] as const;
