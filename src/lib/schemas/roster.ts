import { z } from 'zod';
import type { RosterCategory } from '@/lib/types/roster';

export const ROSTER_CATEGORIES = [
  'core',
  'growth',
  'value',
  'watch',
  'sell',
] as const;

export const ROSTER_CATEGORY_LABELS: Record<RosterCategory, string> = {
  core: 'コア保有',
  growth: '成長枠',
  value: '割安待機',
  watch: '様子見',
  sell: '売却検討',
};

export const ROSTER_CATEGORY_SHORT_LABELS: Record<RosterCategory, string> = {
  core: 'コア',
  growth: '成長',
  value: '割安',
  watch: '様子',
  sell: '売却',
};

export type RosterBadgeStyle = {
  className: string;
};

export const ROSTER_BADGE_STYLES: Record<RosterCategory, RosterBadgeStyle> = {
  core: { className: 'bg-blue-100 text-blue-800 border-blue-300' },
  growth: { className: 'bg-green-100 text-green-800 border-green-300' },
  value: { className: 'bg-amber-100 text-amber-800 border-amber-300' },
  watch: { className: 'bg-gray-100 text-gray-800 border-gray-300' },
  sell: { className: 'bg-red-100 text-red-800 border-red-300' },
};

export const updateRosterSchema = z.object({
  stock_id: z.string().uuid('銘柄IDが不正です'),
  category: z.enum(ROSTER_CATEGORIES, {
    error: 'カテゴリを選択してください',
  }),
  reason: z
    .string()
    .min(1, '変更理由を入力してください')
    .max(500, '変更理由は500文字以内で入力してください'),
});

export type UpdateRosterInput = z.infer<typeof updateRosterSchema>;

export const updateRatingSchema = z.object({
  stock_id: z.string().uuid('銘柄IDが不正です'),
  rating: z.number().int().min(1, '1以上を指定してください').max(5, '5以下を指定してください'),
});

export type UpdateRatingInput = z.infer<typeof updateRatingSchema>;

export const updateBuyPrioritySchema = z.object({
  stock_id: z.string().uuid('銘柄IDが不正です'),
  buy_priority: z.number().int().min(1, '1以上を指定してください').nullable(),
});

export type UpdateBuyPriorityInput = z.infer<typeof updateBuyPrioritySchema>;
