/**
 * XBRL / iXBRL パーサーのテスト
 *
 * このパーサーは CSV 取得失敗時の最後の砦だが、v1.1.0 まで単体テストが無く、
 * 「DEI 文字列を数値化して会計基準判定が壊れる」バグが潜伏していた。
 * 特に危険な落とし穴（scale の乗算・sign の符号反転・DEI 生値）を fixture で固定する。
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { extractFinancialMetricsFromXbrl } from './xbrl-parser';

/** iXBRL（.htm）1ファイル入りの type=1 相当 ZIP を生成する */
async function buildXbrlZip(htmlBody: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    'XBRL/PublicDoc/0101010_honbun_test.htm',
    `<!DOCTYPE html><html><body>${htmlBody}</body></html>`
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('iXBRL の scale / sign 属性', () => {
  it('scale=6 は表示値を100万倍する（見落とすと100万倍ズレる）', async () => {
    const zip = await buildXbrlZip(`
      <ix:nonFraction name="jppfs_cor:NetSales" contextRef="CurrentYearDuration" unitRef="JPY" scale="6">1,234</ix:nonFraction>
    `);
    const summary = await extractFinancialMetricsFromXbrl(zip);
    const revenue = summary.results.find((r) => r.metricKey === 'revenue');
    expect(revenue?.value).toBe(1_234_000_000);
  });

  it('scale=-2 は表示値を1/100にする（EPS等の小数表示）', async () => {
    const zip = await buildXbrlZip(`
      <ix:nonFraction name="jpcrp_cor:BasicEarningsLossPerShareSummaryOfBusinessResults" contextRef="CurrentYearDuration" unitRef="JPYPerShares" scale="-2">12345</ix:nonFraction>
    `);
    const summary = await extractFinancialMetricsFromXbrl(zip);
    const eps = summary.results.find((r) => r.metricKey === 'eps_basic');
    expect(eps?.value).toBeCloseTo(123.45);
  });

  it('sign="-" は値を負にする（マイナス記号がタグ外表記のケース）', async () => {
    const zip = await buildXbrlZip(`
      <ix:nonFraction name="jppfs_cor:OperatingIncome" contextRef="CurrentYearDuration" unitRef="JPY" scale="3" sign="-">500</ix:nonFraction>
    `);
    const summary = await extractFinancialMetricsFromXbrl(zip);
    const op = summary.results.find((r) => r.metricKey === 'operating_profit');
    expect(op?.value).toBe(-500_000);
  });
});

describe('DEI 文字列ファクト（C-2 回帰テスト）', () => {
  it('会計基準 "IFRS" と決算期末日が数値化で破壊されない', async () => {
    const zip = await buildXbrlZip(`
      <ix:nonNumeric name="jpdei_cor:AccountingStandardsDEI" contextRef="FilingDateInstant">IFRS</ix:nonNumeric>
      <ix:nonNumeric name="jpdei_cor:CurrentFiscalYearEndDateDEI" contextRef="FilingDateInstant">2025-03-31</ix:nonNumeric>
      <ix:nonFraction name="jpigp_cor:RevenueIFRS" contextRef="CurrentYearDuration" unitRef="JPY" scale="0">2,000,000</ix:nonFraction>
    `);
    const summary = await extractFinancialMetricsFromXbrl(zip);

    // 旧実装では "IFRS" が NaN→null になり JGAAP にフォールバックし、
    // periodEnd も常に null だった
    expect(summary.accountingStandard).toBe('IFRS');
    expect(summary.periodEnd).toBe('2025-03-31');

    // IFRS と判定されたので IFRS 候補タグ（RevenueIFRS）で売上が取れる
    const revenue = summary.results.find((r) => r.metricKey === 'revenue');
    expect(revenue?.value).toBe(2_000_000);
  });
});

describe('セグメント Member の混入防止（共有抽出ロジック経由）', () => {
  it('プレーンコンテキストの全社値を優先する', async () => {
    const zip = await buildXbrlZip(`
      <ix:nonFraction name="jppfs_cor:NetSales" contextRef="CurrentYearDuration_ReportableSegmentsMember" unitRef="JPY" scale="0">300</ix:nonFraction>
      <ix:nonFraction name="jppfs_cor:NetSales" contextRef="CurrentYearDuration" unitRef="JPY" scale="0">1,000</ix:nonFraction>
    `);
    const summary = await extractFinancialMetricsFromXbrl(zip);
    const revenue = summary.results.find((r) => r.metricKey === 'revenue');
    expect(revenue?.value).toBe(1000);
    expect(revenue?.confidence).toBe('high');
  });
});

describe('従来 XBRL（.xbrl）のパース', () => {
  it('contextRef 付きテキストノードを Fact として抽出できる', async () => {
    const zip = new JSZip();
    zip.file(
      'XBRL/PublicDoc/test.xbrl',
      `<?xml version="1.0" encoding="UTF-8"?>
      <xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:jppfs_cor="http://example.com/jppfs">
        <jppfs_cor:NetSales contextRef="CurrentYearDuration" unitRef="JPY" decimals="0">4112318000</jppfs_cor:NetSales>
        <jppfs_cor:TotalAssets contextRef="CurrentYearInstant" unitRef="JPY" decimals="0">9876543210</jppfs_cor:TotalAssets>
      </xbrli:xbrl>`
    );
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const summary = await extractFinancialMetricsFromXbrl(buf);

    const revenue = summary.results.find((r) => r.metricKey === 'revenue');
    const assets = summary.results.find((r) => r.metricKey === 'total_assets');
    expect(revenue?.value).toBe(4_112_318_000);
    expect(assets?.value).toBe(9_876_543_210);
  });
});
