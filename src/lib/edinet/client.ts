import type { EdinetDocListResponse, EdinetDocument, AnnualReport } from './types';

const EDINET_BASE_URL = 'https://api.edinet-fsa.go.jp/api/v2';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 3_000;

function getApiKey(): string {
  const key = process.env.EDINET_API_KEY;
  if (!key) throw new Error('EDINET_API_KEY が設定されていません');
  return key;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) return res;

      // 401 はリトライしない
      if (res.status === 401) {
        throw new Error('EDINET APIキーが無効です');
      }

      // 500系はリトライ
      if (res.status >= 500 && attempt < retries) {
        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }

      throw new Error(`EDINET API エラー: ${res.status} ${res.statusText}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (attempt < retries) {
          await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error('EDINET APIリクエストがタイムアウトしました');
      }
      throw error;
    }
  }
  throw new Error('EDINET APIへの接続に失敗しました');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指定日付の書類一覧を取得する
 */
export async function fetchDocumentList(date: string): Promise<EdinetDocListResponse> {
  const url = new URL(`${EDINET_BASE_URL}/documents.json`);
  url.searchParams.set('date', date);
  url.searchParams.set('type', '2');
  url.searchParams.set('Subscription-Key', getApiKey());

  const res = await fetchWithRetry(url.toString());
  return (await res.json()) as EdinetDocListResponse;
}

/**
 * 書類データ（ZIP）を取得する
 * @param type 1=XBRL(ZIP), 5=CSV(ZIP)
 */
export async function fetchDocumentData(
  docID: string,
  type: 1 | 5,
): Promise<ArrayBuffer> {
  const url = new URL(`${EDINET_BASE_URL}/documents/${docID}`);
  url.searchParams.set('type', String(type));
  url.searchParams.set('Subscription-Key', getApiKey());

  const res = await fetchWithRetry(url.toString());

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await res.json();
    throw new Error(`EDINET 書類取得エラー: ${JSON.stringify(body)}`);
  }

  return res.arrayBuffer();
}

/**
 * 書類一覧から有価証券報告書のみを抽出する
 */
export function filterAnnualReports(documents: EdinetDocument[]): AnnualReport[] {
  return documents
    .filter(
      (doc) =>
        doc.docTypeCode === '120' &&
        doc.secCode != null &&
        doc.secCode !== '' &&
        (doc.xbrlFlag === '1' || doc.csvFlag === '1') &&
        doc.withdrawalStatus === '0' &&
        doc.disclosureStatus === '0',
    )
    .map((doc) => ({
      docID: doc.docID,
      secCode: doc.secCode!,
      edinetCode: doc.edinetCode,
      filerName: doc.filerName ?? '不明',
      periodStart: doc.periodStart,
      periodEnd: doc.periodEnd,
      submitDateTime: doc.submitDateTime,
      docDescription: doc.docDescription,
      xbrlFlag: doc.xbrlFlag === '1',
      csvFlag: doc.csvFlag === '1',
    }));
}

/**
 * 指定した証券コード（4桁）に一致する有価証券報告書を検索する
 * 日付範囲をイテレートして検索（EDINET APIは日付単位）
 */
export async function searchAnnualReports(
  stockCode: string,
  startDate: string,
  endDate: string,
): Promise<AnnualReport[]> {
  const results: AnnualReport[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const response = await fetchDocumentList(dateStr);
      if (!response.results) continue;

      const reports = filterAnnualReports(response.results);
      const matched = reports.filter(
        (r) => r.secCode.slice(0, 4) === stockCode,
      );
      results.push(...matched);
    } catch {
      // 個別の日付のエラーはスキップして次の日付へ
      continue;
    }

    // レート制限対策
    await sleep(RETRY_BASE_DELAY_MS);
  }

  return results;
}
