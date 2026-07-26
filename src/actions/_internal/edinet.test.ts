/**
 * EDINET の5文字証券コードとアプリの4文字コードの照合を検証します。
 */
import { describe, expect, it } from 'vitest';
import {
  matchesStockCode,
  normalizeEdinetSecurityCode,
} from '@/actions/_internal/edinet';

describe('EDINET証券コードの正規化', () => {
  it.each([
    ['72030', '7203'],
    ['130A0', '130A'],
    ['7203', '7203'],
  ])('%s を %s として扱う', (input, expected) => {
    expect(normalizeEdinetSecurityCode(input)).toBe(expected);
  });

  it('英字の大小を無視して同じ銘柄を照合する', () => {
    expect(matchesStockCode('130a', '130A0')).toBe(true);
  });

  it('別銘柄のEDINETデータを拒否する', () => {
    expect(matchesStockCode('7203', '67580')).toBe(false);
  });
});
