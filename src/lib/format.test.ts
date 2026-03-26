import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatStockPrice,
  formatPercent,
  formatPercentUnsigned,
  formatMultiple,
  formatPerShare,
  NULL_DISPLAY,
} from './format';

describe('formatCurrency', () => {
  it('億円単位に変換する（1億以上）', () => {
    expect(formatCurrency(35_000_000_000)).toBe('350.0億円');
    expect(formatCurrency(100_000_000)).toBe('1.0億円');
    expect(formatCurrency(4_500_000_000)).toBe('45.0億円');
  });

  it('百万円単位に変換する（100万以上1億未満）', () => {
    expect(formatCurrency(50_000_000)).toBe('50.0百万円');
    expect(formatCurrency(1_000_000)).toBe('1.0百万円');
  });

  it('円単位で表示する（100万未満）', () => {
    expect(formatCurrency(999_999)).toBe('999,999円');
    expect(formatCurrency(250)).toBe('250円');
    expect(formatCurrency(0)).toBe('0円');
  });

  it('負の値にマイナス符号を付ける', () => {
    expect(formatCurrency(-2_000_000_000)).toBe('-20.0億円');
    expect(formatCurrency(-50_000_000)).toBe('-50.0百万円');
    expect(formatCurrency(-500)).toBe('-500円');
  });

  it('百万円→億円の境界値で正しい単位になる', () => {
    // 99,950,000 は toFixed(1) で 100.0 百万になるが、億円にフォールバック
    expect(formatCurrency(99_950_000)).toBe('1.0億円');
    // 99,949,999 は 99.9百万円のまま
    expect(formatCurrency(99_949_999)).toBe('99.9百万円');
  });

  it('nullの場合はダッシュを返す', () => {
    expect(formatCurrency(null)).toBe(NULL_DISPLAY);
  });
});

describe('formatStockPrice', () => {
  it('カンマ区切り+円で表示する', () => {
    expect(formatStockPrice(470)).toBe('470円');
    expect(formatStockPrice(1_250)).toBe('1,250円');
  });

  it('nullの場合はダッシュを返す', () => {
    expect(formatStockPrice(null)).toBe(NULL_DISPLAY);
  });
});

describe('formatPercent', () => {
  it('正の値に+符号を付ける', () => {
    expect(formatPercent(11.11)).toBe('+11.11%');
    expect(formatPercent(50)).toBe('+50%');
  });

  it('負の値はそのまま', () => {
    expect(formatPercent(-22.94)).toBe('-22.94%');
  });

  it('0は符号なし', () => {
    expect(formatPercent(0)).toBe('0%');
  });

  it('浮動小数点誤差を丸める', () => {
    expect(formatPercent(15.120000000001)).toBe('+15.12%');
    expect(formatPercent(-0.30000000000000004)).toBe('-0.3%');
  });

  it('nullの場合はダッシュを返す', () => {
    expect(formatPercent(null)).toBe(NULL_DISPLAY);
  });
});

describe('formatPercentUnsigned', () => {
  it('符号なしで表示する', () => {
    expect(formatPercentUnsigned(50)).toBe('50%');
    expect(formatPercentUnsigned(7.5)).toBe('7.5%');
  });

  it('nullの場合はダッシュを返す', () => {
    expect(formatPercentUnsigned(null)).toBe(NULL_DISPLAY);
  });
});

describe('formatMultiple', () => {
  it('倍で表示する', () => {
    expect(formatMultiple(8.33)).toBe('8.33倍');
    expect(formatMultiple(15.67)).toBe('15.67倍');
  });

  it('nullの場合はダッシュを返す', () => {
    expect(formatMultiple(null)).toBe(NULL_DISPLAY);
  });
});

describe('formatPerShare', () => {
  it('円で表示する', () => {
    expect(formatPerShare(30)).toBe('30円');
  });

  it('nullの場合はダッシュを返す', () => {
    expect(formatPerShare(null)).toBe(NULL_DISPLAY);
  });
});
