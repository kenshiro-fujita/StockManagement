/**
 * EDINET XBRL / iXBRL パーサー（CSV フォールバック用）
 *
 * csvFlag=0 の書類や、CSV 取得に失敗した場合に使用する。
 * type=1（XBRL ZIP）を展開し、以下の2形式を両方パースする:
 *
 * 1. 従来 XBRL (.xbrl) — fast-xml-parser で XML → JSON → 再帰走査
 * 2. インライン XBRL (.htm) — cheerio で HTML DOM から ix:nonFraction タグを抽出
 *
 * 重要な落とし穴:
 * - iXBRL の scale 属性: 表示値に 10^scale を掛ける必要がある（見落とすと100万倍ズレる）
 * - iXBRL の sign 属性: "-" なら値を負にする
 * - contextRef の判別: NonConsolidatedMember を含まない = 連結
 */
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

/**
 * XBRL から抽出した1つの Fact
 * CSV の CsvFact と異なり、value は既に数値化済み（iXBRL の scale/sign 適用済み）
 */
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
 *
 * fast-xml-parser で XML を JSON に変換し、再帰的に走査して
 * 名前空間付き要素（例: jppfs_cor:NetSales）のテキストノードを抽出する。
 *
 * fast-xml-parser の出力形式:
 * - 属性は "@_" プレフィックス付きのプロパティ（例: @_contextRef）
 * - テキストノードは "#text" キー
 * - isArray: () => true で全要素を配列化（一貫した走査のため）
 */
function parseTraditionalXbrl(xmlContent: string): XbrlFact[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: false,     // 名前空間プレフィックスを保持（ローカル名抽出は自分で行う）
    isArray: () => true,       // 全要素を配列として扱う（単一要素でも [elem] の形になる）
  });

  const doc = parser.parse(xmlContent);
  const facts: XbrlFact[] = [];

  // JSON ツリーを再帰的に走査し、contextRef 属性を持つテキストノードを Fact として収集する
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
 *
 * HTML の中に埋め込まれた XBRL タグ（ix:nonFraction, ix:nonNumeric）を
 * cheerio の CSS セレクタで抽出する。
 *
 * 注意すべき属性:
 * - scale: 表示値に 10^scale を乗算（例: scale="6" → 百万円単位 → 円に変換）
 * - sign: "-" なら値を負にする（マイナス記号がタグの外に書かれる場合がある）
 * - name: "jppfs_cor:NetSales" 形式 → コロン以降がローカル名
 */
function parseInlineXbrl(htmlContent: string): XbrlFact[] {
  const $ = cheerio.load(htmlContent, { xmlMode: false });
  const facts: XbrlFact[] = [];

  // ix:nonFraction — 数値データ（売上高、純利益等）
  $('ix\\:nonFraction, ix\\:nonfraction').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name') ?? '';
    const contextRef = $el.attr('contextref') ?? '';
    const unitRef = $el.attr('unitref') ?? '';
    const scale = parseInt($el.attr('scale') ?? '0', 10);  // scale=0 ならそのまま
    const sign = $el.attr('sign') ?? '';                     // sign="-" なら負
    const rawText = $el.text().trim();                       // タグ内テキスト（表示値）

    let num = normalizeNumber(rawText);
    // scale 属性の適用: 表示値 × 10^scale = 実際の値（円）
    if (num != null && scale !== 0) {
      num = num * Math.pow(10, scale);
    }
    // sign 属性の適用: マイナス記号がタグ外に記載される場合の対応
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
