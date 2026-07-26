/**
 * EDINET 検索の日付範囲バリデーション（共通）
 *
 * EDINET 検索は日付を1日ずつループして外部APIを叩くため、
 * 範囲が無検証だと巨大レンジで大量リクエスト・長時間占有（コストベースDoS）になる。
 * UI・Server Action の両方でこの検証を通すこと。
 */
import { isValidIsoDate } from '@/lib/utils/date';

/** バックログ F21: バッチ取得は最大6か月までに制限する */
export const MAX_RANGE_DAYS = 184;

/** UTC 日付計算で使う1日分のミリ秒。単位の取り違えを防ぐ。 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC 基準の日数差（end - start）。両端を含むので +1 */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / MILLISECONDS_PER_DAY) + 1;
}

export type DateRangeValidation =
  | { ok: true; days: number }
  | { ok: false; error: string };

/**
 * 日付範囲を検証する。
 * - 形式・実在チェック
 * - start <= end
 * - 最大日数（既定 MAX_RANGE_DAYS = 6か月）
 */
export function validateDateRange(
  startDate: string,
  endDate: string,
  maxDays: number = MAX_RANGE_DAYS
): DateRangeValidation {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return { ok: false, error: '日付は YYYY-MM-DD 形式で入力してください' };
  }
  const days = inclusiveDayCount(startDate, endDate);
  if (days < 1) {
    return { ok: false, error: '開始日は終了日以前にしてください' };
  }
  if (days > maxDays) {
    return {
      ok: false,
      error: `検索範囲は最大 ${maxDays} 日（約6か月）までです`,
    };
  }
  return { ok: true, days };
}
