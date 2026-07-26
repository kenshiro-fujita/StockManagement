import { describe, expect, it } from 'vitest';

import { isValidIsoDate } from './date';

describe('isValidIsoDate', () => {
  it('実在する ISO 暦日を受け付ける', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
  });

  it('自動補正される不正な暦日を拒否する', () => {
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('2025-02-30')).toBe(false);
  });

  it('ISO 暦日以外の形式を拒否する', () => {
    expect(isValidIsoDate('2025-2-03')).toBe(false);
    expect(isValidIsoDate('not-a-date')).toBe(false);
  });
});
