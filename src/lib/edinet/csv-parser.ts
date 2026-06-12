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
import { detectAccountingStandard } from './taxonomy';
import {
  extractAllMetrics,
  findDeiRawValue,
  type NormalizedFact,
} from './extraction';

// 抽出結果の型は extraction.ts に一本化した。既存の import 元を壊さないため再エクスポートする
export type { ExtractionResult, ExtractionSummary } from './extraction';
import type { ExtractionSummary } from './extraction';

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
  const headerCols = lines[0].split('\t').map((c) => c.replace(/"/g, '').trim());
  const colIdx = (name: string): number => {
    const i = headerCols.indexOf(name);
    return i >= 0 ? i : -1;
  };

  // EDINET CSV の列名で列インデックスを特定
  const iElem = colIdx('要素ID') >= 0 ? colIdx('要素ID') : 0;
  const iCtx = colIdx('コンテキストID') >= 0 ? colIdx('コンテキストID') : 2;
  const iUnit = colIdx('ユニットID') >= 0 ? colIdx('ユニットID') : 6;
  const iVal = colIdx('値') >= 0 ? colIdx('値') : 8;

  const facts: CsvFact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map((c) => c.replace(/"/g, '').trim());
    if (cols.length <= iElem) continue;

    const elementName = cols[iElem] ?? '';
    const contextId = cols[iCtx] ?? '';
    const unitId = cols[iUnit] ?? '';
    const value = cols[iVal] ?? '';

    if (!elementName) continue;

    const localName = elementName.includes(':')
      ? elementName.split(':').pop()!
      : elementName;

    facts.push({ elementName, localName, contextId, unitId, value });
  }

  return facts;
}

/**
 * 日本の有価証券報告書に特有の数値表記を、JavaScript の number に正規化する
 *
 * 処理する表記パターン:
 * - 全角数字（０１２...） → 半角に変換
 * - カンマ区切り（1,234,567） → 除去
 * - △/▲ マイナス（△1,234） → -1234
 * - 括弧マイナス（(1,234)） → -1234
 * - 全角マイナス（−、–、—、―） → 半角ハイフンに統一
 * - ダッシュ単体（—） → null（「該当なし」の意味）
 */
export function normalizeNumber(raw: string): number | null {
  if (!raw) return null;

  let s = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角→半角
    .replace(/[,，\s]/g, '')   // カンマ・スペース除去
    .replace(/[△▲]/g, '-')    // 三角マイナス → ハイフン
    .replace(/[−–—―‐]/g, '-'); // 各種全角マイナス → ハイフン

  // 括弧マイナス: (1,234) → -1234
  const parenMatch = s.match(/^\((.+)\)$/);
  if (parenMatch) {
    s = '-' + parenMatch[1];
  }

  // ダッシュ単体は「該当なし」（null）として扱う
  // （全角ダッシュは上の置換で既に '-' へ統一済みなので、ここでは半角のみ判定すればよい）
  if (s === '-' || s === '') return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * CsvFact を共有抽出モジュールの NormalizedFact に変換する
 * 数値化はここで一度だけ行い、生テキストは rawValue として保持する
 * （DEI 系の文字列ファクトは数値化すると null に潰れるため）
 */
function toNormalizedFacts(facts: CsvFact[]): NormalizedFact[] {
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
  zipData: ArrayBuffer,
): Promise<ExtractionSummary> {
  const csvContents = await extractCsvFromZip(zipData);
  const allFacts: CsvFact[] = [];

  for (const csv of csvContents) {
    allFacts.push(...parseTsvToFacts(csv));
  }

  const facts = toNormalizedFacts(allFacts);

  // 会計基準と決算期末は文字列ファクト（rawValue）から判定する
  const standard = detectAccountingStandard(findDeiRawValue(facts, 'AccountingStandardsDEI'));
  const periodEnd = findDeiRawValue(facts, 'CurrentFiscalYearEndDateDEI');

  return {
    accountingStandard: standard,
    periodEnd,
    results: extractAllMetrics(facts, standard),
  };
}
