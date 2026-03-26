import { describe, it, expect } from 'vitest';
import { updateParametersSchema, PARAMETER_DEFAULTS } from './parameters';

const validInput = {
  stock_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  ...PARAMETER_DEFAULTS,
};

describe('updateParametersSchema', () => {
  it('accepts valid default parameters', () => {
    const result = updateParametersSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts boundary minimum values', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      discount_rate: 0.001,
      growth_rate: 0,
      tax_rate: 0,
      cap_multiplier: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts boundary maximum values', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      discount_rate: 0.3,
      growth_rate: 0.15,
      tax_rate: 1.0,
      cap_multiplier: 100,
    });
    // discount_rate (0.3) > growth_rate (0.15) → should pass
    expect(result.success).toBe(true);
  });

  it('rejects discount_rate below minimum', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      discount_rate: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects discount_rate above maximum', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      discount_rate: 0.31,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative growth_rate', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      growth_rate: -0.01,
    });
    expect(result.success).toBe(false);
  });

  it('rejects growth_rate above maximum', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      growth_rate: 0.16,
    });
    expect(result.success).toBe(false);
  });

  it('rejects tax_rate above 100%', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      tax_rate: 1.01,
    });
    expect(result.success).toBe(false);
  });

  it('rejects cap_multiplier below 1', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      cap_multiplier: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects cap_multiplier above 100', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      cap_multiplier: 101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects discount_rate equal to growth_rate (r must be > g)', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      discount_rate: 0.05,
      growth_rate: 0.05,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const discountError = result.error.issues.find((i) => i.path.includes('discount_rate'));
      expect(discountError?.message).toContain('割引率は成長率より大きい値');
    }
  });

  it('rejects discount_rate less than growth_rate', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      discount_rate: 0.02,
      growth_rate: 0.05,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid stock_id', () => {
    const result = updateParametersSchema.safeParse({
      ...validInput,
      stock_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});
