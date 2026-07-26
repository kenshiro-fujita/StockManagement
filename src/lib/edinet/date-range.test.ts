import { describe, it, expect } from 'vitest';
import {
  validateDateRange,
  inclusiveDayCount,
  MAX_RANGE_DAYS,
} from './date-range';

describe('inclusiveDayCount', () => {
  it('同日は1日', () => {
    expect(inclusiveDayCount('2025-03-01', '2025-03-01')).toBe(1);
  });
  it('両端を含む', () => {
    expect(inclusiveDayCount('2025-03-01', '2025-03-07')).toBe(7);
  });
  it('UTC基準で月またぎも正しい', () => {
    expect(inclusiveDayCount('2025-02-28', '2025-03-01')).toBe(2);
  });
});

describe('validateDateRange', () => {
  it('正常な範囲は ok', () => {
    const r = validateDateRange('2025-03-01', '2025-03-31');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.days).toBe(31);
  });

  it('開始 > 終了 は拒否', () => {
    const r = validateDateRange('2025-03-31', '2025-03-01');
    expect(r.ok).toBe(false);
  });

  it('不正な日付形式は拒否', () => {
    expect(validateDateRange('2025/03/01', '2025-03-31').ok).toBe(false);
    expect(validateDateRange('', '2025-03-31').ok).toBe(false);
    expect(validateDateRange('2025-13-01', '2025-03-31').ok).toBe(false);
  });

  it('暦に存在しない日付は Date の繰り上げに任せず拒否する', () => {
    expect(validateDateRange('2025-02-29', '2025-03-31').ok).toBe(false);
    expect(validateDateRange('2025-02-30', '2025-03-31').ok).toBe(false);
    expect(validateDateRange('2025-04-31', '2025-05-01').ok).toBe(false);
  });

  it('うるう年の2月29日は受け付ける', () => {
    const result = validateDateRange('2024-02-29', '2024-02-29');
    expect(result).toEqual({ ok: true, days: 1 });
  });

  it('最大日数を超えると拒否（既定6か月）', () => {
    // 2024-01-01 から MAX_RANGE_DAYS 日ちょうどは ok、+1 日で拒否
    const okEnd = new Date(
      Date.UTC(2024, 0, 1) + (MAX_RANGE_DAYS - 1) * 86400000
    )
      .toISOString()
      .slice(0, 10);
    const ngEnd = new Date(Date.UTC(2024, 0, 1) + MAX_RANGE_DAYS * 86400000)
      .toISOString()
      .slice(0, 10);
    expect(validateDateRange('2024-01-01', okEnd).ok).toBe(true);
    expect(validateDateRange('2024-01-01', ngEnd).ok).toBe(false);
  });
});
