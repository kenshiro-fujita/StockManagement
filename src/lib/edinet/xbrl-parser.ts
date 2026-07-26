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
  createExtractionSummary,
  type ExtractionSummary,
  type NormalizedFact,
} from './extraction';
import { extractLocalName, normalizeNumber } from './fact-utils';

/**
 * ZIP (type=1) から XBRL/iXBRL ファイルを抽出してパースする
 */
export async function extractFinancialMetricsFromXbrl(
  zipData: ArrayBuffer
): Promise<ExtractionSummary> {
  const zip = await JSZip.loadAsync(zipData);
  const facts: NormalizedFact[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    // XBRL/PublicDoc 内のファイルを対象
    const isPublicDoc =
      path.includes('XBRL/PublicDoc/') || path.includes('PublicDoc/');

    if (!isPublicDoc) continue;

    if (path.endsWith('.xbrl')) {
      const content = await file.async('string');
      facts.push(...parseTraditionalXbrl(content));
    } else if (path.endsWith('.htm') || path.endsWith('.html')) {
      const content = await file.async('string');
      facts.push(...parseInlineXbrl(content));
    }
  }

  return createExtractionSummary(facts, 'xbrl');
}

/**
 * fast-xml-parser は isArray 設定により属性も配列へ包むため、先頭値へ統一する。
 */
function readXmlAttribute(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return value != null ? String(value) : '';
}

/**
 * XML の JSON ツリーを走査し、contextRef を持つ名前空間付き要素だけを収集する。
 *
 * コンテキスト要素やリンク要素まで Fact と誤認しないため、従来どおり
 * 名前空間付きの親要素にある #text だけを対象とする。
 */
function collectTraditionalFacts(
  node: unknown,
  parentKey: string,
  facts: NormalizedFact[]
): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      collectTraditionalFacts(item, parentKey, facts);
    }
    return;
  }

  if (typeof node !== 'object') return;

  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('@_')) continue;

    if (typeof value === 'object' && value !== null) {
      collectTraditionalFacts(value, key, facts);
      continue;
    }

    if (key !== '#text' || !parentKey.includes(':')) continue;

    const rawValue = String(value);
    facts.push({
      localName: extractLocalName(parentKey),
      contextId: readXmlAttribute(record['@_contextRef']),
      unitId: readXmlAttribute(record['@_unitRef']),
      value: normalizeNumber(rawValue),
      rawValue,
    });
  }
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
function parseTraditionalXbrl(xmlContent: string): NormalizedFact[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: false, // 名前空間プレフィックスを保持（ローカル名抽出は自分で行う）
    isArray: () => true, // 全要素を配列として扱う（単一要素でも [elem] の形になる）
  });

  const doc = parser.parse(xmlContent);
  const facts: NormalizedFact[] = [];

  collectTraditionalFacts(doc, '', facts);
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
function parseInlineXbrl(htmlContent: string): NormalizedFact[] {
  const $ = cheerio.load(htmlContent, { xmlMode: false });
  const facts: NormalizedFact[] = [];

  // ix:nonFraction — 数値データ（売上高、純利益等）
  $('ix\\:nonFraction, ix\\:nonfraction').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name') ?? '';
    const contextRef = $el.attr('contextref') ?? '';
    const unitRef = $el.attr('unitref') ?? '';
    const scale = parseInt($el.attr('scale') ?? '0', 10); // scale=0 ならそのまま
    const sign = $el.attr('sign') ?? ''; // sign="-" なら負
    const rawText = $el.text().trim(); // タグ内テキスト（表示値）

    let num = normalizeNumber(rawText);
    // scale 属性の適用: 表示値 × 10^scale = 実際の値（円）
    if (num != null && scale !== 0) {
      num = num * Math.pow(10, scale);
    }
    // sign 属性の適用: マイナス記号がタグ外に記載される場合の対応
    if (num != null && sign === '-') {
      num = -Math.abs(num);
    }

    const localName = extractLocalName(name);

    facts.push({
      localName,
      contextId: contextRef,
      unitId: unitRef,
      value: num,
      rawValue: rawText,
    });
  });

  // ix:nonNumeric — 文字列データ（会計基準判定等に使用）
  // 数値化（value）は試みるが、本質は rawValue（"IFRS" や日付等の生テキスト）の保持
  $('ix\\:nonNumeric, ix\\:nonnumeric').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name') ?? '';
    const contextRef = $el.attr('contextref') ?? '';
    const localName = extractLocalName(name);
    const rawValue = $el.text().trim();

    facts.push({
      localName,
      contextId: contextRef,
      unitId: '',
      value: normalizeNumber(rawValue),
      rawValue,
    });
  });

  return facts;
}

// コンテキスト判定・メトリック抽出は extraction.ts（CSV/XBRL 共通）に一本化した
