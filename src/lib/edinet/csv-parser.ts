import JSZip from 'jszip';
import iconv from 'iconv-lite';
import {
  METRIC_TAGS,
  METRIC_LABELS,
  AGGREGATE_METRICS,
  detectAccountingStandard,
  type AccountingStandard,
  type MetricKey,
} from './taxonomy';

/** CSV から抽出した1つの Fact */
export type CsvFact = {
  elementName: string;
  localName: string;
  contextId: string;
  unitId: string;
  value: string;
};

/** 抽出結果 */
export type ExtractionResult = {
  metricKey: MetricKey;
  label: string;
  value: number | null;
  matchedTag: string | null;
  contextId: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export type ExtractionSummary = {
  accountingStandard: AccountingStandard;
  periodEnd: string | null;
  results: ExtractionResult[];
};

/**
 * ZIP (type=5) から CSV ファイルを抽出してデコードする
 */
export async function extractCsvFromZip(zipData: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(zipData);
  const csvContents: string[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (path.startsWith('XBRL_TO_CSV/') && path.endsWith('.csv')) {
      const buf = await file.async('nodebuffer');
      // UTF-16LE デコード（BOM 自動処理）
      const text = iconv.decode(buf, 'utf-16le');
      csvContents.push(text);
    }
  }

  return csvContents;
}

/**
 * TSV テキストを Fact 配列にパースする
 */
export function parseTsvToFacts(tsv: string): CsvFact[] {
  const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return []; // ヘッダー行 + データが必要

  // ヘッダー行から列インデックスを特定
  const header = lines[0].split('\t');
  const colMap: Record<string, number> = {};
  header.forEach((col, i) => {
    colMap[col.trim()] = i;
  });

  const facts: CsvFact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 3) continue;

    // 列名は EDINET CSV のフォーマットに依存
    // 代表的なパターン: 要素ID / コンテキストID / ユニットID / 値
    const elementName = cols[0]?.trim() ?? '';
    const contextId = cols[1]?.trim() ?? '';
    const unitId = cols[2]?.trim() ?? '';
    const value = cols[3]?.trim() ?? '';

    if (!elementName) continue;

    // ローカル名を抽出（名前空間プレフィックス除去）
    const localName = elementName.includes(':')
      ? elementName.split(':').pop()!
      : elementName;

    facts.push({ elementName, localName, contextId, unitId, value });
  }

  return facts;
}

/**
 * contextRef が連結・当期かどうかを判定する
 */
function isConsolidatedCurrent(contextId: string): boolean {
  return (
    (contextId.includes('CurrentYear') || contextId.includes('CurrentDuration') || contextId.includes('CurrentInstant')) &&
    !contextId.includes('NonConsolidatedMember')
  );
}

function isConsolidatedInstant(contextId: string): boolean {
  return (
    contextId.includes('CurrentYearInstant') &&
    !contextId.includes('NonConsolidatedMember')
  );
}

/**
 * 数値を正規化する（全角→半角、カンマ除去、マイナス記号統一）
 */
export function normalizeNumber(raw: string): number | null {
  if (!raw) return null;

  let s = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s]/g, '')
    .replace(/[△▲]/g, '-')
    .replace(/[−–—―‐]/g, '-');

  // 括弧マイナス
  const parenMatch = s.match(/^\((.+)\)$/);
  if (parenMatch) {
    s = '-' + parenMatch[1];
  }

  // ダッシュ系（該当なし）
  if (s === '-' || s === '' || s === '—' || s === '―') return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fact 配列から指定メトリックの値を抽出する（優先順位付きフォールバック）
 */
function extractMetric(
  facts: CsvFact[],
  metricKey: MetricKey,
  standard: AccountingStandard,
): ExtractionResult {
  const candidates = METRIC_TAGS[metricKey][standard] ?? METRIC_TAGS[metricKey].JGAAP ?? [];
  const isAggregate = AGGREGATE_METRICS.includes(metricKey);

  if (isAggregate) {
    // 合算メトリック: 各タグの値を全て足す
    let total = 0;
    let found = false;
    const matchedTags: string[] = [];

    for (const tag of candidates) {
      const fact = facts.find(
        (f) => f.localName === tag && isConsolidatedInstant(f.contextId),
      );
      if (fact) {
        const num = normalizeNumber(fact.value);
        if (num != null) {
          total += num;
          found = true;
          matchedTags.push(tag);
        }
      }
    }

    return {
      metricKey,
      label: METRIC_LABELS[metricKey],
      value: found ? total : null,
      matchedTag: matchedTags.length > 0 ? matchedTags.join('+') : null,
      contextId: null,
      confidence: found ? 'medium' : 'low',
    };
  }

  // 通常メトリック: 優先順に検索、最初にヒットした値を採用
  for (const tag of candidates) {
    // B/S項目（資産・負債）は Instant、P/L・CF項目は Duration
    const bsMetrics: MetricKey[] = ['total_assets', 'equity'];
    const isBs = bsMetrics.includes(metricKey);

    const matchingFacts = facts.filter(
      (f) =>
        f.localName === tag &&
        (isBs ? isConsolidatedInstant(f.contextId) : isConsolidatedCurrent(f.contextId)),
    );

    if (matchingFacts.length > 0) {
      const fact = matchingFacts[0];
      const num = normalizeNumber(fact.value);
      return {
        metricKey,
        label: METRIC_LABELS[metricKey],
        value: num,
        matchedTag: tag,
        contextId: fact.contextId,
        confidence: num != null ? 'high' : 'low',
      };
    }
  }

  return {
    metricKey,
    label: METRIC_LABELS[metricKey],
    value: null,
    matchedTag: null,
    contextId: null,
    confidence: 'low',
  };
}

/**
 * CSV ZIP から主要財務指標を一括抽出する
 */
export async function extractFinancialMetrics(
  zipData: ArrayBuffer,
): Promise<ExtractionSummary> {
  const csvContents = await extractCsvFromZip(zipData);
  const allFacts: CsvFact[] = [];

  for (const csv of csvContents) {
    allFacts.push(...parseTsvToFacts(csv));
  }

  // 会計基準を判定
  const deiStandard = allFacts.find((f) => f.localName === 'AccountingStandardsDEI');
  const standard = detectAccountingStandard(deiStandard?.value);

  // 決算期末を取得
  const periodEnd = allFacts.find((f) => f.localName === 'CurrentFiscalYearEndDateDEI');

  // 全メトリックを抽出
  const metricKeys: MetricKey[] = [
    'revenue',
    'operating_profit',
    'net_income_parent',
    'total_assets',
    'equity',
    'operating_cf',
    'investing_cf',
    'issued_shares',
    'eps_basic',
    'interest_bearing_debt',
    'interest_expense',
  ];

  const results = metricKeys.map((key) => extractMetric(allFacts, key, standard));

  return {
    accountingStandard: standard,
    periodEnd: periodEnd?.value ?? null,
    results,
  };
}
