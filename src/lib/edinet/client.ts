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

/** EDINET API v2 のベース URL */
const EDINET_BASE_URL = 'https://api.edinet-fsa.go.jp/api/v2';
/** リクエストタイムアウト（NFR18 準拠: 30秒以内） */
const REQUEST_TIMEOUT_MS = 30_000;
/** 最大リトライ回数（NFR18 準拠: 最大3回） */
const MAX_RETRIES = 3;
/** リトライ間隔のベース値（レート制限対策: 3秒） */
const RETRY_BASE_DELAY_MS = 3_000;

/** EDINET API キーを取得する（user_settings → 環境変数の順で解決） */
let _cachedApiKey: string | null = null;

async function resolveApiKey(): Promise<string> {
  if (_cachedApiKey) return _cachedApiKey;
  try {
    const { getSetting } = await import('@/actions/settings');
    const userKey = await getSetting('edinet_api_key');
    if (userKey) {
      _cachedApiKey = userKey;
      return userKey;
    }
  } catch {
    // Server Action が使えない場合はフォールバック
  }
  const envKey = process.env.EDINET_API_KEY;
  if (envKey) {
    _cachedApiKey = envKey;
    return envKey;
  }
  throw new Error('EDINET APIキーが設定されていません。ユーザー設定画面から登録してください。');
}

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
  url.searchParams.set('Subscription-Key', await resolveApiKey());

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
  url.searchParams.set('Subscription-Key', await resolveApiKey());

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
