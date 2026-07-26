/**
 * EDINET CSV (type=5) パーサー
 *
 * EDINET API の type=5 で取得できる CSV（実態は UTF-16LE の TSV）を解析し、
 * 主要財務指標を抽出するモジュール。
 *
 * 処理フロー:
 * 1. ZIP 展開 → XBRL_TO_CSV/ フォルダ内の .csv ファイルを取得
 * 2. UTF-16LE → UTF-8 デコード（iconv-lite 使用）
 * 3. TSV をパースして Fact 配列に変換
 * 4. 会計基準を判定（AccountingStandardsDEI タグ）
 * 5. 各メトリックについて、taxonomy.ts の候補タグリストで優先順検索
 * 6. contextRef で連結/単体・当期/前期をフィルタ
 */
import JSZip from 'jszip';
import iconv from 'iconv-lite';
import {
  createExtractionSummary,
  type ExtractionSummary,
  type NormalizedFact,
} from './extraction';
import { extractLocalName, normalizeNumber } from './fact-utils';

// 抽出結果の型は extraction.ts に一本化した。既存の import 元を壊さないため再エクスポートする
export type { ExtractionResult, ExtractionSummary } from './extraction';
export { normalizeNumber } from './fact-utils';

/**
 * CSV から抽出した1つの Fact（XBRL の要素1つに対応）
 * - elementName: 名前空間付きの完全な要素名（例: "jppfs_cor:NetSales"）
 * - localName: 名前空間を除去した要素名（例: "NetSales"）← タグ照合に使用
 * - contextId: コンテキスト（連結/単体・当期/前期の判別に使用）
 * - value: 文字列のままの生の値（正規化は後工程）
 */
export type CsvFact = {
  elementName: string;
  localName: string;
  contextId: string;
  unitId: string;
  value: string;
};

/** EDINET の各セルはダブルクォート囲みなので、比較・数値化前に除去する。 */
function parseTsvRow(line: string): string[] {
  return line.split('\t').map((cell) => cell.replace(/"/g, '').trim());
}

/** ヘッダー名が見つからない旧形式では、既知の列位置へフォールバックする。 */
function resolveColumnIndex(
  headers: readonly string[],
  name: string,
  fallbackIndex: number
): number {
  const index = headers.indexOf(name);
  return index >= 0 ? index : fallbackIndex;
}

/**
 * ZIP (type=5) から CSV ファイルを抽出してデコードする
 */
export async function extractCsvFromZip(
  zipData: ArrayBuffer
): Promise<string[]> {
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
 *
 * EDINET CSV の実際の列構造（9列、ダブルクォート囲み）:
 * [0] "要素ID"      — 例: "jppfs_cor:NetSales"
 * [1] "項目名"      — 例: "売上高"（日本語ラベル）
 * [2] "コンテキストID" — 例: "CurrentYearDuration"
 * [3] "相対年度"    — 例: "当期"
 * [4] "連結・個別"  — 例: "連結" / "個別" / "その他"
 * [5] "期間・時点"  — 例: "期間" / "時点"
 * [6] "ユニットID"  — 例: "JPY"
 * [7] "単位"        — 例: "円"
 * [8] "値"          — 例: "4112318000"
 */
export function parseTsvToFacts(tsv: string): CsvFact[] {
  const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // ヘッダー行から列名→インデックスのマッピングを構築
  const headerLine = lines[0];
  if (!headerLine) return [];
  const headerColumns = parseTsvRow(headerLine);

  // EDINET CSV の列名で列インデックスを特定
  const elementIndex = resolveColumnIndex(headerColumns, '要素ID', 0);
  const contextIndex = resolveColumnIndex(headerColumns, 'コンテキストID', 2);
  const unitIndex = resolveColumnIndex(headerColumns, 'ユニットID', 6);
  const valueIndex = resolveColumnIndex(headerColumns, '値', 8);

  const facts: CsvFact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const columns = parseTsvRow(line);
    if (columns.length <= elementIndex) continue;

    const elementName = columns[elementIndex] ?? '';
    const contextId = columns[contextIndex] ?? '';
    const unitId = columns[unitIndex] ?? '';
    const value = columns[valueIndex] ?? '';

    if (!elementName) continue;

    const localName = extractLocalName(elementName);

    facts.push({ elementName, localName, contextId, unitId, value });
  }

  return facts;
}

/**
 * CsvFact を共有抽出モジュールの NormalizedFact に変換する
 * 数値化はここで一度だけ行い、生テキストは rawValue として保持する
 * （DEI 系の文字列ファクトは数値化すると null に潰れるため）
 */
function toNormalizedFacts(facts: readonly CsvFact[]): NormalizedFact[] {
  return facts.map((f) => ({
    localName: f.localName,
    contextId: f.contextId,
    unitId: f.unitId,
    value: normalizeNumber(f.value),
    rawValue: f.value,
  }));
}

/**
 * CSV ZIP から主要財務指標を一括抽出する
 * Fact の生成（ZIP展開・TSVパース・数値正規化）のみ担当し、
 * 指標の選択ロジックは extraction.ts（CSV/XBRL 共通）に委譲する
 */
export async function extractFinancialMetrics(
  zipData: ArrayBuffer
): Promise<ExtractionSummary> {
  const csvContents = await extractCsvFromZip(zipData);
  const allFacts: CsvFact[] = [];

  for (const csv of csvContents) {
    allFacts.push(...parseTsvToFacts(csv));
  }

  const facts = toNormalizedFacts(allFacts);

  return createExtractionSummary(facts, 'csv');
}
