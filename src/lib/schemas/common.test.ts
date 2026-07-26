/**
 * Server Action で共有するプリミティブ入力境界を検証します。
 */
import { describe, expect, it } from 'vitest';
import {
  edinetDocumentIdSchema,
  fiscalYearSchema,
  fourDigitStockCodeSchema,
  idSchema,
  stockIdSchema,
} from '@/lib/schemas/common';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('共通 Server Action スキーマ', () => {
  it('正しいUUIDだけをIDとして受け付ける', () => {
    expect(idSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(stockIdSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(idSchema.safeParse('../other-user').success).toBe(false);
  });

  it.each([1900, 2026, 2100])('許容範囲内の年度 %i を受け付ける', (year) => {
    expect(fiscalYearSchema.safeParse(year).success).toBe(true);
  });

  it.each([1899, 2101, 2026.5, '2026'])(
    '許容範囲外または非整数の年度 %s を拒否する',
    (year) => {
      expect(fiscalYearSchema.safeParse(year).success).toBe(false);
    }
  );

  it('EDINET検索用の4桁数字だけを受け付ける', () => {
    expect(fourDigitStockCodeSchema.safeParse('7203').success).toBe(true);
    expect(fourDigitStockCodeSchema.safeParse('720').success).toBe(false);
    expect(fourDigitStockCodeSchema.safeParse('13A0').success).toBe(false);
  });

  it('英数字のEDINET書類IDを受け付け、パス文字を拒否する', () => {
    expect(edinetDocumentIdSchema.safeParse('S100AB12').success).toBe(true);
    expect(edinetDocumentIdSchema.safeParse('../../secret').success).toBe(
      false
    );
    expect(edinetDocumentIdSchema.safeParse('').success).toBe(false);
  });
});
