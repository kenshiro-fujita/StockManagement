import { describe, it, expect } from 'vitest';
import { findBestIndex, COMPARISON_CATEGORIES } from './comparison';

describe('findBestIndex', () => {
  it('direction=higher で最大値のインデックスを返す', () => {
    expect(findBestIndex([10, 20, 15], 'higher')).toBe(1);
  });

  it('direction=lower で最小値のインデックスを返す', () => {
    expect(findBestIndex([10, 20, 5], 'lower')).toBe(2);
  });

  it('direction=none で -1 を返す', () => {
    expect(findBestIndex([10, 20, 15], 'none')).toBe(-1);
  });

  it('null を含む場合はスキップする', () => {
    expect(findBestIndex([null, 20, null], 'higher')).toBe(1);
  });

  it('全て null の場合は -1 を返す', () => {
    expect(findBestIndex([null, null], 'higher')).toBe(-1);
  });

  it('1件だけの場合はそのインデックスを返す', () => {
    expect(findBestIndex([42], 'higher')).toBe(0);
  });

  it('負の値を正しく比較する（higher）', () => {
    expect(findBestIndex([-5, -10, -3], 'higher')).toBe(2);
  });

  it('負の値を正しく比較する（lower）', () => {
    expect(findBestIndex([-5, -10, -3], 'lower')).toBe(1);
  });
});

describe('COMPARISON_CATEGORIES', () => {
  it('5カテゴリが定義されている', () => {
    expect(COMPARISON_CATEGORIES).toHaveLength(5);
  });

  it('各カテゴリに少なくとも1つの指標がある', () => {
    for (const cat of COMPARISON_CATEGORIES) {
      expect(cat.indicators.length).toBeGreaterThan(0);
    }
  });
});
