/**
 * 共有抽出ロジック（extraction.ts）のテスト
 *
 * 特に「セグメント注記の Member コンテキスト混入」と
 * 「DEI 文字列ファクトの生値保持」は、過去に実バグとして検出された
 * （売上高にセグメント値が入る / XBRL経路で会計基準が常にJGAAPになる）ため固定する。
 */
import { describe, it, expect } from 'vitest';
import {
  extractMetric,
  extractAllMetrics,
  findDeiRawValue,
  type NormalizedFact,
} from './extraction';

/** テスト用 Fact を簡潔に作るヘルパー */
function fact(
  localName: string,
  contextId: string,
  value: number | null,
  rawValue?: string,
): NormalizedFact {
  return {
    localName,
    contextId,
    unitId: 'JPY',
    value,
    rawValue: rawValue ?? (value != null ? String(value) : ''),
  };
}

describe('プレーンコンテキスト優先（C-4: セグメント値混入の防止）', () => {
  it('Member 付きが先に並んでいても、プレーンコンテキストの全社値を採用する', () => {
    const facts = [
      // セグメント注記（ファイル内でこちらが先に出現するケース）
      fact('NetSales', 'CurrentYearDuration_ReportableSegmentsMember', 300),
      fact('NetSales', 'CurrentYearDuration_Segment1Member', 100),
      // 全社値
      fact('NetSales', 'CurrentYearDuration', 1000),
    ];
    const result = extractMetric(facts, 'revenue', 'JGAAP');
    expect(result.value).toBe(1000);
    expect(result.contextId).toBe('CurrentYearDuration');
    expect(result.confidence).toBe('high');
  });

  it('プレーンが無く Member 付きのみの場合は採用するが confidence を medium に降格', () => {
    const facts = [
      fact('NetSales', 'CurrentYearDuration_ReportableSegmentsMember', 300),
    ];
    const result = extractMetric(facts, 'revenue', 'JGAAP');
    expect(result.value).toBe(300);
    expect(result.confidence).toBe('medium');
  });

  it('単体（NonConsolidatedMember）は連結指標として採用しない', () => {
    const facts = [
      fact('NetSales', 'CurrentYearDuration_NonConsolidatedMember', 500),
    ];
    const result = extractMetric(facts, 'revenue', 'JGAAP');
    expect(result.value).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('B/S 項目は Instant コンテキストから取得する', () => {
    const facts = [
      fact('TotalAssets', 'CurrentYearDuration', 999), // 誤った Duration は拾わない
      fact('TotalAssets', 'CurrentYearInstant', 5000),
    ];
    const result = extractMetric(facts, 'total_assets', 'JGAAP');
    expect(result.value).toBe(5000);
    expect(result.confidence).toBe('high');
  });

  it('発行済株式数（連結/単体不問）は単体プレーンも許可する', () => {
    const facts = [
      fact('TotalNumberOfIssuedSharesSummaryOfBusinessResults', 'CurrentYearInstant_NonConsolidatedMember', 1_000_000),
    ];
    const result = extractMetric(facts, 'issued_shares', 'JGAAP');
    expect(result.value).toBe(1_000_000);
    expect(result.confidence).toBe('high');
  });
});

describe('合算メトリック（有利子負債）', () => {
  it('候補タグごとにプレーン優先で1件選んで合計する', () => {
    const facts = [
      fact('ShortTermLoansPayable', 'CurrentYearInstant', 100),
      // 同一タグの Member 重複は二重計上しない
      fact('ShortTermLoansPayable', 'CurrentYearInstant_SomeMember', 999),
      fact('LongTermLoansPayable', 'CurrentYearInstant', 200),
      fact('LeaseObligationsCL', 'CurrentYearInstant', 30),
      fact('LeaseObligationsNCL', 'CurrentYearInstant', 70),
    ];
    const result = extractMetric(facts, 'interest_bearing_debt', 'JGAAP');
    expect(result.value).toBe(400); // 100 + 200 + 30 + 70
    expect(result.matchedTag).toContain('ShortTermLoansPayable');
    expect(result.matchedTag).toContain('LeaseObligationsNCL');
    expect(result.confidence).toBe('medium');
  });
});

describe('DEI 文字列ファクト（C-2: 生値の保持）', () => {
  it('findDeiRawValue は数値化で null に潰れた文字列も生値で返す', () => {
    const facts = [
      // "IFRS" は normalizeNumber で null になるが rawValue には残る
      fact('AccountingStandardsDEI', 'FilingDateInstant', null, 'IFRS'),
      fact('CurrentFiscalYearEndDateDEI', 'FilingDateInstant', null, '2025-03-31'),
    ];
    expect(findDeiRawValue(facts, 'AccountingStandardsDEI')).toBe('IFRS');
    expect(findDeiRawValue(facts, 'CurrentFiscalYearEndDateDEI')).toBe('2025-03-31');
    expect(findDeiRawValue(facts, 'NonexistentDEI')).toBeNull();
  });
});

describe('IFRS タグの抽出（C-1: IFRS サフィックス付き要素名）', () => {
  it('RevenueIFRS / OperatingProfitLossIFRS を候補として検索できる', () => {
    const facts = [
      fact('RevenueIFRS', 'CurrentYearDuration', 2_000_000),
      fact('OperatingProfitLossIFRS', 'CurrentYearDuration', 300_000),
    ];
    const results = extractAllMetrics(facts, 'IFRS');
    const revenue = results.find((r) => r.metricKey === 'revenue');
    const op = results.find((r) => r.metricKey === 'operating_profit');
    expect(revenue?.value).toBe(2_000_000);
    expect(revenue?.matchedTag).toBe('RevenueIFRS');
    expect(op?.value).toBe(300_000);
    expect(op?.matchedTag).toBe('OperatingProfitLossIFRS');
  });

  it('JGAAP の営業CFは NetCashProvidedByUsedInOperatingActivities で取得できる', () => {
    const facts = [
      fact('NetCashProvidedByUsedInOperatingActivities', 'CurrentYearDuration', 12_345),
    ];
    const result = extractMetric(facts, 'operating_cf', 'JGAAP');
    expect(result.value).toBe(12_345);
  });
});
