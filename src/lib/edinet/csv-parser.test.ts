import { describe, it, expect } from 'vitest';
import { normalizeNumber, parseTsvToFacts } from './csv-parser';
import {
  detectAccountingStandard,
  METRIC_TAGS,
  METRIC_LABELS,
} from './taxonomy';

describe('normalizeNumber', () => {
  it('通常の整数を変換する', () => {
    expect(normalizeNumber('1234567')).toBe(1234567);
  });

  it('カンマ付き数値を変換する', () => {
    expect(normalizeNumber('1,234,567')).toBe(1234567);
  });

  it('全角数字を半角に変換する', () => {
    expect(normalizeNumber('１２３４')).toBe(1234);
  });

  it('△ をマイナスに変換する', () => {
    expect(normalizeNumber('△1,234')).toBe(-1234);
  });

  it('▲ をマイナスに変換する', () => {
    expect(normalizeNumber('▲5678')).toBe(-5678);
  });

  it('括弧マイナスを変換する', () => {
    expect(normalizeNumber('(1,234)')).toBe(-1234);
  });

  it('全角マイナス記号を変換する', () => {
    expect(normalizeNumber('−1234')).toBe(-1234);
  });

  it('空文字列は null を返す', () => {
    expect(normalizeNumber('')).toBeNull();
  });

  it('ダッシュ系は null を返す', () => {
    expect(normalizeNumber('-')).toBeNull();
    expect(normalizeNumber('—')).toBeNull();
    expect(normalizeNumber('―')).toBeNull();
  });

  it('小数を変換する', () => {
    expect(normalizeNumber('12.34')).toBeCloseTo(12.34);
  });
});

describe('parseTsvToFacts', () => {
  it('EDINET CSV（9列）のヘッダーとデータ行をパースする', () => {
    const tsv =
      '"要素ID"\t"項目名"\t"コンテキストID"\t"相対年度"\t"連結・個別"\t"期間・時点"\t"ユニットID"\t"単位"\t"値"\n"jppfs_cor:NetSales"\t"売上高"\t"CurrentYearDuration"\t"当期"\t"連結"\t"期間"\t"JPY"\t"円"\t"1000000"';
    const facts = parseTsvToFacts(tsv);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.localName).toBe('NetSales');
    expect(facts[0]?.contextId).toBe('CurrentYearDuration');
    expect(facts[0]?.value).toBe('1000000');
  });

  it('空行をスキップする', () => {
    const tsv =
      '"要素ID"\t"項目名"\t"コンテキストID"\t"相対年度"\t"連結・個別"\t"期間・時点"\t"ユニットID"\t"単位"\t"値"\n\n"jppfs_cor:NetSales"\t"売上高"\t"Ctx"\t"当期"\t"連結"\t"期間"\t"JPY"\t"円"\t"100"';
    const facts = parseTsvToFacts(tsv);
    expect(facts).toHaveLength(1);
  });

  it('ヘッダーのみの場合は空配列を返す', () => {
    const tsv =
      '"要素ID"\t"項目名"\t"コンテキストID"\t"相対年度"\t"連結・個別"\t"期間・時点"\t"ユニットID"\t"単位"\t"値"';
    const facts = parseTsvToFacts(tsv);
    expect(facts).toHaveLength(0);
  });

  it('名前空間プレフィックスを除去してローカル名を抽出する', () => {
    const tsv =
      '"要素ID"\t"項目名"\t"コンテキストID"\t"相対年度"\t"連結・個別"\t"期間・時点"\t"ユニットID"\t"単位"\t"値"\n"jppfs_cor:TotalAssets"\t"総資産"\t"Ctx"\t"当期"\t"連結"\t"時点"\t"JPY"\t"円"\t"999"';
    const facts = parseTsvToFacts(tsv);
    expect(facts[0]?.localName).toBe('TotalAssets');
  });
});

describe('detectAccountingStandard', () => {
  it('Japan GAAP を JGAAP と判定する', () => {
    expect(detectAccountingStandard('Japan GAAP')).toBe('JGAAP');
  });

  it('IFRS を IFRS と判定する', () => {
    expect(detectAccountingStandard('IFRS')).toBe('IFRS');
  });

  it('US GAAP を USGAAP と判定する', () => {
    expect(detectAccountingStandard('US GAAP')).toBe('USGAAP');
  });

  it('JMIS を IFRS と判定する', () => {
    expect(detectAccountingStandard('JMIS')).toBe('IFRS');
  });

  it('null は JGAAP にフォールバックする', () => {
    expect(detectAccountingStandard(null)).toBe('JGAAP');
  });
});

describe('METRIC_TAGS', () => {
  it('全メトリックにJGAAPのタグが定義されている', () => {
    for (const [key, tags] of Object.entries(METRIC_TAGS)) {
      expect(tags.JGAAP, `${key} にJGAAPタグがない`).toBeDefined();
      expect(tags.JGAAP!.length, `${key} のJGAAPタグが空`).toBeGreaterThan(0);
    }
  });

  it('全メトリックにラベルが定義されている', () => {
    for (const key of Object.keys(METRIC_TAGS)) {
      expect(METRIC_LABELS[key as keyof typeof METRIC_LABELS]).toBeTruthy();
    }
  });
});
