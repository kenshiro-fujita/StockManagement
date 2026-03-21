import { describe, it, expect } from 'vitest';
import { calcChangeRate, formatChangeRate } from './financial-data-list';

describe('calcChangeRate', () => {
  it('calculates positive change', () => {
    expect(calcChangeRate(120, 100)).toBeCloseTo(20);
  });

  it('calculates negative change', () => {
    expect(calcChangeRate(80, 100)).toBeCloseTo(-20);
  });

  it('returns null when previous is zero', () => {
    expect(calcChangeRate(100, 0)).toBeNull();
  });

  it('handles negative previous value correctly', () => {
    // -50 to -100: change = (-100 - (-50)) / |-50| * 100 = -100%
    expect(calcChangeRate(-100, -50)).toBeCloseTo(-100);
  });

  it('handles zero change', () => {
    expect(calcChangeRate(100, 100)).toBe(0);
  });

  it('handles large percentage changes', () => {
    expect(calcChangeRate(1000, 1)).toBeCloseTo(99900);
  });
});

describe('formatChangeRate', () => {
  it('formats positive rate with + sign', () => {
    expect(formatChangeRate(12.34)).toBe('+12.3%');
  });

  it('formats negative rate with - sign', () => {
    expect(formatChangeRate(-5.67)).toBe('-5.7%');
  });

  it('formats zero rate with + sign', () => {
    expect(formatChangeRate(0)).toBe('+0.0%');
  });

  it('rounds to one decimal place', () => {
    expect(formatChangeRate(33.333)).toBe('+33.3%');
    expect(formatChangeRate(-66.666)).toBe('-66.7%');
  });
});
