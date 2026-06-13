/**
 * EDINET API v2 クライアント
 *
 * 金融庁の EDINET API を呼び出して、有価証券報告書の検索・取得を行う。
 * サーバーサイド専用（クロスドメイン通信が禁止されているため）。
 *
 * 主な責務:
 * - 書類一覧の取得（日付指定）
 * - 書類データ（ZIP）の取得（docID指定）
 * - 有価証券報告書のフィルタリング
 * - 証券コードによる有報検索（日付範囲イテレーション）
 */
import type { EdinetDocListResponse, EdinetDocument, AnnualReport } from './types';
import { validateDateRange } from './date-range';

/** EDINET API v2 のベース URL */
const EDINET_BASE_URL = 'https://api.edinet-fsa.go.jp/api/v2';
/** リクエストタイムアウト（NFR18 準拠: 30秒以内） */
const REQUEST_TIMEOUT_MS = 30_000;
/** 最大リトライ回数（NFR18 準拠: 最大3回） */
const MAX_RETRIES = 3;
/** リトライ間隔のベース値（レート制限対策: 3秒） */
const RETRY_BASE_DELAY_MS = 3_000;

// APIキーはこのモジュールでは解決しない（モジュールスコープのキャッシュは
// サーバーレス環境でユーザー間にキーが漏用される事故になるため）。
// 呼び出し側（Server Actions）が lib/edinet/api-key.ts の resolveEdinetApiKey() で
// リクエストごとに解決し、各関数へ引数として渡す。

/**
 * タイムアウト付き fetch + 指数バックオフリトライ
 * - 401（認証エラー）はリトライしない
 * - 500系（サーバーエラー）とタイムアウトはリトライする
 */
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

      // 401 はリトライしない（キーが無効なので待っても無駄）
      if (res.status === 401) {
        throw new Error('EDINET APIキーが無効です');
      }

      // 429（レート制限）と 500系はリトライ対象（時間を置けば回復しうる）
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
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

/** 指定ミリ秒だけ待機する（レート制限の間隔調整に使用） */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指定日付の書類一覧を取得する
 */
export async function fetchDocumentList(
  date: string,
  apiKey: string,
): Promise<EdinetDocListResponse> {
  const url = new URL(`${EDINET_BASE_URL}/documents.json`);
  url.searchParams.set('date', date);
  url.searchParams.set('type', '2');
  url.searchParams.set('Subscription-Key', apiKey);

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
  apiKey: string,
): Promise<ArrayBuffer> {
  const url = new URL(`${EDINET_BASE_URL}/documents/${docID}`);
  url.searchParams.set('type', String(type));
  url.searchParams.set('Subscription-Key', apiKey);

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
 *
 * フィルタ条件:
 * - docTypeCode === '120'（有価証券報告書）
 * - secCode が存在する（証券コードで銘柄照合するため）
 * - XBRL または CSV データが利用可能
 * - 取下・不開示でない通常の書類
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
 *
 * EDINET API は「日付単位」でしか書類一覧を取得できないため、
 * 指定された日付範囲を1日ずつイテレートして検索する。
 * 各リクエスト間には RETRY_BASE_DELAY_MS のスリープを挟んでレート制限に対応する。
 *
 * 注意: EDINET の secCode は5桁（例: "72030"）、stocks の stock_code は4桁（例: "7203"）。
 * 先頭4桁で照合する。
 */
export async function searchAnnualReports(
  stockCode: string,
  startDate: string,
  endDate: string,
  apiKey: string,
): Promise<AnnualReport[]> {
  // 範囲はリソース枯渇を防ぐため必ず検証する（呼び出し側でも検証するが多層防御）
  const validation = validateDateRange(startDate, endDate);
  if (!validation.ok) throw new Error(validation.error);

  const results: AnnualReport[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  // 日付の加算・整形は UTC で一貫させる（ローカルタイム混在だと
  // タイムゾーン境界で1日抜け・重複が起こりうる）
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const response = await fetchDocumentList(dateStr, apiKey);
      if (!response.results) continue;

      const reports = filterAnnualReports(response.results);
      // secCode の先頭4桁と証券コード（4桁）を照合
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
