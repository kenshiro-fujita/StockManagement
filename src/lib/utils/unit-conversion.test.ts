import { describe, it, expect } from 'vitest';
import { toYen, fromYen } from './unit-conversion';

describe('toYen', () => {
  it('円をそのまま返す', () => {
    expect(toYen(1234, 'yen')).toBe(1234);
  });

  it('千円を円に変換する', () => {
    expect(toYen(500, 'thousand')).toBe(500_000);
  });

  it('百万円を円に変換する', () => {
    expect(toYen(1234, 'million')).toBe(1_234_000_000);
  });

  it('10億円を円に変換する', () => {
    expect(toYen(1, 'billion')).toBe(1_000_000_000);
    expect(toYen(5, 'billion')).toBe(5_000_000_000);
  });

  it('小数点を四捨五入する', () => {
    expect(toYen(1.5, 'thousand')).toBe(1500);
    expect(toYen(1.999, 'million')).toBe(1_999_000);
  });

  it('0を正しく処理する', () => {
    expect(toYen(0, 'million')).toBe(0);
  });

  it('負の値を正しく変換する', () => {
    expect(toYen(-100, 'million')).toBe(-100_000_000);
  });
});

describe('fromYen', () => {
  it('円をそのまま返す', () => {
    expect(fromYen(1234, 'yen')).toBe(1234);
  });

  it('円を千円に変換する', () => {
    expect(fromYen(500_000, 'thousand')).toBe(500);
  });

  it('円を百万円に変換する', () => {
    expect(fromYen(1_234_000_000, 'million')).toBe(1234);
  });

  it('円を10億円に変換する', () => {
    expect(fromYen(1_000_000_000, 'billion')).toBe(1);
    expect(fromYen(5_000_000_000, 'billion')).toBe(5);
  });

  it('割り切れない場合は小数を返す', () => {
    expect(fromYen(1_500, 'thousand')).toBe(1.5);
  });
});
