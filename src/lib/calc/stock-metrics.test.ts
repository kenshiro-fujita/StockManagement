import { describe, it, expect } from 'vitest';
import { calcEPS, calcPER, calcPBR, calcFCF } from './stock-metrics';

describe('calcEPS', () => {
  it('EPSを正しく算出する', () => {
    const result = calcEPS(500_000_000, 10_000_000);
    expect(result.value).toBe(50);
  });

  it('小数点以下第2位を四捨五入する', () => {
    const result = calcEPS(333_333, 10_000);
    expect(result.value).toBe(33.33);
  });

  it('sharesOutstandingがnullの場合はnullを返す', () => {
    const result = calcEPS(500_000_000, null);
    expect(result.value).toBeNull();
  });

  it('sharesOutstandingが0の場合はnullを返す', () => {
    const result = calcEPS(500_000_000, 0);
    expect(result.value).toBeNull();
  });
});

describe('calcPER', () => {
  it('PERを正しく算出する', () => {
    const result = calcPER(2500, 50);
    expect(result.value).toBe(50);
  });

  it('currentStockPriceがnullの場合はnullを返す', () => {
    const result = calcPER(null, 50);
    expect(result.value).toBeNull();
  });

  it('EPSがnullの場合はnullを返す', () => {
    const result = calcPER(2500, null);
    expect(result.value).toBeNull();
  });

  it('EPSが0の場合はnullを返す', () => {
    const result = calcPER(2500, 0);
    expect(result.value).toBeNull();
  });

  it('赤字EPSの場合は負のPERを返す', () => {
    const result = calcPER(2500, -50);
    expect(result.value).toBe(-50);
  });
});

describe('calcPBR', () => {
  it('PBRを正しく算出する', () => {
    // PBR = 2500 × 10,000,000 ÷ 20,000,000,000 = 1.25
    const result = calcPBR(2500, 10_000_000, 20_000_000_000);
    expect(result.value).toBe(1.25);
  });

  it('currentStockPriceがnullの場合はnullを返す', () => {
    const result = calcPBR(null, 10_000_000, 20_000_000_000);
    expect(result.value).toBeNull();
  });

  it('sharesOutstandingがnullの場合はnullを返す', () => {
    const result = calcPBR(2500, null, 20_000_000_000);
    expect(result.value).toBeNull();
  });

  it('equityが0の場合はnullを返す', () => {
    const result = calcPBR(2500, 10_000_000, 0);
    expect(result.value).toBeNull();
  });
});

describe('calcFCF', () => {
  it('FCFを正しく算出する', () => {
    const result = calcFCF(3_000_000_000, -1_500_000_000);
    expect(result.value).toBe(1_500_000_000);
  });

  it('operatingCFがnullの場合はnullを返す', () => {
    const result = calcFCF(null, -1_500_000_000);
    expect(result.value).toBeNull();
  });

  it('investingCFがnullの場合はnullを返す', () => {
    const result = calcFCF(3_000_000_000, null);
    expect(result.value).toBeNull();
  });

  it('投資CFが正の場合もそのまま加算する', () => {
    const result = calcFCF(3_000_000_000, 500_000_000);
    expect(result.value).toBe(3_500_000_000);
  });
});
