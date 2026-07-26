import { afterEach, describe, it, expect, vi } from 'vitest';
import { fetchDocumentList, filterAnnualReports } from './client';
import type { EdinetDocument } from './types';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function makeDoc(overrides: Partial<EdinetDocument> = {}): EdinetDocument {
  return {
    seqNumber: 1,
    docID: 'S1000001',
    edinetCode: 'E10001',
    secCode: '72030',
    JCN: null,
    filerName: 'テスト株式会社',
    fundCode: null,
    ordinanceCode: '010',
    formCode: '030000',
    docTypeCode: '120',
    periodStart: '2024-04-01',
    periodEnd: '2025-03-31',
    submitDateTime: '2025-06-15 09:00',
    docDescription: '有価証券報告書',
    issuerEdinetCode: null,
    subjectEdinetCode: null,
    subsidiaryEdinetCode: null,
    currentReportReason: null,
    parentDocID: null,
    opeDateTime: null,
    withdrawalStatus: '0',
    docInfoEditStatus: '0',
    disclosureStatus: '0',
    xbrlFlag: '1',
    pdfFlag: '1',
    attachDocFlag: '0',
    englishDocFlag: '0',
    csvFlag: '1',
    legalStatus: '1',
    ...overrides,
  };
}

describe('filterAnnualReports', () => {
  it('docTypeCode=120 の有価証券報告書を抽出する', () => {
    const docs = [
      makeDoc({ docTypeCode: '120' }),
      makeDoc({ docTypeCode: '130', docID: 'S1000002' }),
    ];
    const result = filterAnnualReports(docs);
    expect(result).toHaveLength(1);
    expect(result[0]?.docID).toBe('S1000001');
  });

  it('xbrlFlag=0 かつ csvFlag=0 の書類を除外する', () => {
    const docs = [makeDoc({ xbrlFlag: '0', csvFlag: '0' })];
    const result = filterAnnualReports(docs);
    expect(result).toHaveLength(0);
  });

  it('csvFlag=1 のみの書類も含める', () => {
    const docs = [makeDoc({ xbrlFlag: '0', csvFlag: '1' })];
    const result = filterAnnualReports(docs);
    expect(result).toHaveLength(1);
  });

  it('secCode が null の書類を除外する', () => {
    const docs = [makeDoc({ secCode: null })];
    const result = filterAnnualReports(docs);
    expect(result).toHaveLength(0);
  });

  it('取下書（withdrawalStatus=1）を除外する', () => {
    const docs = [makeDoc({ withdrawalStatus: '1' })];
    const result = filterAnnualReports(docs);
    expect(result).toHaveLength(0);
  });

  it('不開示書類（disclosureStatus=2）を除外する', () => {
    const docs = [makeDoc({ disclosureStatus: '2' })];
    const result = filterAnnualReports(docs);
    expect(result).toHaveLength(0);
  });

  it('AnnualReport 型に正しく変換する', () => {
    const docs = [makeDoc()];
    const result = filterAnnualReports(docs);
    expect(result[0]).toEqual({
      docID: 'S1000001',
      secCode: '72030',
      edinetCode: 'E10001',
      filerName: 'テスト株式会社',
      periodStart: '2024-04-01',
      periodEnd: '2025-03-31',
      submitDateTime: '2025-06-15 09:00',
      docDescription: '有価証券報告書',
      xbrlFlag: true,
      csvFlag: true,
    });
  });

  it('複数の有効な有報を全て返す', () => {
    const docs = [
      makeDoc({ docID: 'S1000001' }),
      makeDoc({ docID: 'S1000003', secCode: '99840' }),
    ];
    const result = filterAnnualReports(docs);
    expect(result).toHaveLength(2);
  });
});

describe('fetchDocumentList', () => {
  it('EDINET API v2 の必須クエリを組み立てる', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchDocumentList('2025-06-15', 'test-api-key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe(
      'https://api.edinet-fsa.go.jp/api/v2/documents.json'
    );
    expect(url.searchParams.get('date')).toBe('2025-06-15');
    expect(url.searchParams.get('type')).toBe('2');
    expect(url.searchParams.get('Subscription-Key')).toBe('test-api-key');
  });

  it('401 は待機しても回復しないため再試行しない', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 401,
        statusText: 'Unauthorized',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchDocumentList('2025-06-15', 'invalid-api-key')
    ).rejects.toThrow('EDINET APIキーが無効です');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('一時的なサーバーエラーは待機後に再試行する', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 503,
          statusText: 'Service Unavailable',
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [] }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const pendingResponse = fetchDocumentList('2025-06-15', 'test-api-key');
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(pendingResponse).resolves.toEqual({ results: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
