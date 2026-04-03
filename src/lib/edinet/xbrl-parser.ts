import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import {
  METRIC_TAGS,
  METRIC_LABELS,
  AGGREGATE_METRICS,
  detectAccountingStandard,
  type AccountingStandard,
  type MetricKey,
} from './taxonomy';
import { normalizeNumber, type ExtractionResult, type ExtractionSummary } from './csv-parser';

/** XBRL Fact（従来XBRLまたはiXBRLから抽出） */
type XbrlFact = {
  localName: string;
  contextRef: string;
  unitRef: string;
  value: number | null;
};

/**
 * ZIP (type=1) から XBRL/iXBRL ファイルを抽出してパースする
 */
export async function extractFinancialMetricsFromXbrl(
  zipData: ArrayBuffer,
): Promise<ExtractionSummary> {
  const zip = await JSZip.loadAsync(zipData);
  const allFacts: XbrlFact[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    // XBRL/PublicDoc 内のファイルを対象
    const isPublicDoc =
      path.includes('XBRL/PublicDoc/') || path.includes('PublicDoc/');

    if (!isPublicDoc) continue;

    if (path.endsWith('.xbrl')) {
      const content = await file.async('string');
      allFacts.push(...parseTraditionalXbrl(content));
    } else if (path.endsWith('.htm') || path.endsWith('.html')) {
      const content = await file.async('string');
      allFacts.push(...parseInlineXbrl(content));
    }
  }

  // 会計基準を判定
  const deiStandard = allFacts.find((f) => f.localName === 'AccountingStandardsDEI');
  const standard = detectAccountingStandard(
    deiStandard?.value != null ? String(deiStandard.value) : null,
  );

  // 決算期末を取得
  const periodEndFact = allFacts.find((f) => f.localName === 'CurrentFiscalYearEndDateDEI');

  // 全メトリックを抽出
  const metricKeys: MetricKey[] = [
    'revenue', 'operating_profit', 'net_income_parent',
    'total_assets', 'equity',
    'operating_cf', 'investing_cf',
    'issued_shares', 'eps_basic',
    'interest_bearing_debt', 'interest_expense',
  ];

  const results = metricKeys.map((key) => extractMetricFromFacts(allFacts, key, standard));

  return {
    accountingStandard: standard,
    periodEnd: periodEndFact?.value != null ? String(periodEndFact.value) : null,
    results,
  };
}

/**
 * 従来 XBRL (.xbrl) をパースする
 */
function parseTraditionalXbrl(xmlContent: string): XbrlFact[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: false,
    isArray: () => true,
  });

  const doc = parser.parse(xmlContent);
  const facts: XbrlFact[] = [];

  // 再帰的に全要素を走査
  function traverse(obj: unknown, parentKey = '') {
    if (obj == null) return;
    if (Array.isArray(obj)) {
      for (const item of obj) traverse(item, parentKey);
      return;
    }
    if (typeof obj !== 'object') return;

    const record = obj as Record<string, unknown>;
    for (const [key, val] of Object.entries(record)) {
      if (key.startsWith('@_')) continue;

      if (typeof val === 'object' && val !== null) {
        traverse(val, key);
        continue;
      }

      // 名前空間付き要素（例: jppfs_cor:NetSales）
      if (key.includes(':') && parentKey.includes(':')) {
        // これは属性ではなくテキストノード
        continue;
      }

      // 属性付きオブジェクトのパターン
      if (key === '#text' && parentKey.includes(':')) {
        const attrs = record as Record<string, unknown>;
        const contextRef = (attrs['@_contextRef'] as string) ?? '';
        const unitRef = (attrs['@_unitRef'] as string) ?? '';
        const localName = parentKey.includes(':')
          ? parentKey.split(':').pop()!
          : parentKey;

        facts.push({
          localName,
          contextRef,
          unitRef,
          value: normalizeNumber(String(val)),
        });
      }
    }
  }

  traverse(doc);
  return facts;
}

/**
 * iXBRL (.htm/.html) をパースする
 */
function parseInlineXbrl(htmlContent: string): XbrlFact[] {
  const $ = cheerio.load(htmlContent, { xmlMode: false });
  const facts: XbrlFact[] = [];

  // ix:nonFraction — 数値データ
  $('ix\\:nonFraction, ix\\:nonfraction').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name') ?? '';
    const contextRef = $el.attr('contextref') ?? '';
    const unitRef = $el.attr('unitref') ?? '';
    const scale = parseInt($el.attr('scale') ?? '0', 10);
    const sign = $el.attr('sign') ?? '';
    const rawText = $el.text().trim();

    let num = normalizeNumber(rawText);
    if (num != null && scale !== 0) {
      num = num * Math.pow(10, scale);
    }
    if (num != null && sign === '-') {
      num = -Math.abs(num);
    }

    const localName = name.includes(':') ? name.split(':').pop()! : name;

    facts.push({ localName, contextRef, unitRef, value: num });
  });

  // ix:nonNumeric — 文字列データ（会計基準判定等に使用）
  $('ix\\:nonNumeric, ix\\:nonnumeric').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name') ?? '';
    const contextRef = $el.attr('contextref') ?? '';
    const localName = name.includes(':') ? name.split(':').pop()! : name;

    facts.push({
      localName,
      contextRef,
      unitRef: '',
      value: normalizeNumber($el.text().trim()),
    });
  });

  return facts;
}

function isConsolidatedCurrent(contextRef: string): boolean {
  return (
    (contextRef.includes('CurrentYear') || contextRef.includes('CurrentDuration')) &&
    !contextRef.includes('NonConsolidatedMember')
  );
}

function isConsolidatedInstant(contextRef: string): boolean {
  return (
    contextRef.includes('CurrentYearInstant') &&
    !contextRef.includes('NonConsolidatedMember')
  );
}

function extractMetricFromFacts(
  facts: XbrlFact[],
  metricKey: MetricKey,
  standard: AccountingStandard,
): ExtractionResult {
  const candidates = METRIC_TAGS[metricKey][standard] ?? METRIC_TAGS[metricKey].JGAAP ?? [];
  const isAggregate = AGGREGATE_METRICS.includes(metricKey);

  if (isAggregate) {
    let total = 0;
    let found = false;
    const matchedTags: string[] = [];

    for (const tag of candidates) {
      const fact = facts.find(
        (f) => f.localName === tag && isConsolidatedInstant(f.contextRef),
      );
      if (fact?.value != null) {
        total += fact.value;
        found = true;
        matchedTags.push(tag);
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

  const bsMetrics: MetricKey[] = ['total_assets', 'equity'];
  const isBs = bsMetrics.includes(metricKey);

  for (const tag of candidates) {
    const matchingFacts = facts.filter(
      (f) =>
        f.localName === tag &&
        (isBs ? isConsolidatedInstant(f.contextRef) : isConsolidatedCurrent(f.contextRef)),
    );

    if (matchingFacts.length > 0 && matchingFacts[0].value != null) {
      return {
        metricKey,
        label: METRIC_LABELS[metricKey],
        value: matchingFacts[0].value,
        matchedTag: tag,
        contextId: matchingFacts[0].contextRef,
        confidence: 'high',
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
