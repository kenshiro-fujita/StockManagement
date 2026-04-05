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
  METRIC_TAGS,
  METRIC_LABELS,
  AGGREGATE_METRICS,
  detectAccountingStandard,
  type AccountingStandard,
  type MetricKey,
} from './taxonomy';

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
 * 1つの財務指標の抽出結果
 * - matchedTag: 実際にマッチしたXBRLタグ名（ログ・変更検出に使用）
 * - confidence: 抽出の信頼度（high=タグ一致+値あり, medium=合算, low=未検出）
 */
export type ExtractionResult = {
  metricKey: MetricKey;
  label: string;
  value: number | null;
  matchedTag: string | null;
  contextId: string | null;
  confidence: 'high' | 'medium' | 'low';
};

/**
 * 1つの有価証券報告書からの全抽出結果
 * - accountingStandard: 自動判定された会計基準
 * - periodEnd: 決算期末日（年度の推定に使用）
 */
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
 * contextRef が「連結かつ当期」かどうかを判定する
 *
 * EDINET のコンテキストID命名規則:
 * - "CurrentYear" を含む = 当期
 * - "NonConsolidatedMember" を含まない = 連結（含む場合は単体）
 *
 * P/L（損益計算書）や CF（キャッシュフロー計算書）の数値を取得する際に使用する。
 */
function isConsolidatedCurrent(contextId: string): boolean {
  return (
    (contextId.includes('CurrentYear') || contextId.includes('CurrentDuration') || contextId.includes('CurrentInstant')) &&
    !contextId.includes('NonConsolidatedMember')
  );
}

/**
 * contextRef が「連結かつ当期時点」かどうかを判定する
 * B/S（貸借対照表）の数値（総資産、自己資本等）を取得する際に使用する。
 * B/S は「ある時点」の残高なので Instant、P/L は「期間」の累計なので Duration。
 */
function isConsolidatedInstant(contextId: string): boolean {
  return (
    contextId.includes('CurrentYearInstant') &&
    !contextId.includes('NonConsolidatedMember')
  );
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
  if (s === '-' || s === '' || s === '—' || s === '―') return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fact 配列から指定メトリックの値を抽出する（優先順位付きフォールバック検索）
 *
 * 通常メトリック:
 *   候補タグを先頭から順に検索し、最初にヒットした値を採用する。
 *   例: revenue の IFRS → ["Revenue", "SalesRevenues", ...] を順にチェック
 *
 * 合算メトリック（interest_bearing_debt）:
 *   候補タグの値を全て見つけて合計する。
 *   例: ShortTermLoansPayable + LongTermLoansPayable + BondsPayable
 *
 * B/S vs P/L の判別:
 *   total_assets, equity → Instant（時点残高）で検索
 *   それ以外 → Duration/Current（期間累計）で検索
 */
/** 連結/単体を問わないメトリック（企業全体で1つの値しかない） */
const CONSOLIDATION_AGNOSTIC_METRICS: MetricKey[] = ['issued_shares', 'eps_basic'];

/** B/S（貸借対照表）項目: Instant（時点）コンテキストで検索する */
const BS_METRICS: MetricKey[] = [
  'total_assets', 'equity', 'cash_and_equivalents', 'current_assets',
  'investments_and_other_assets', 'current_liabilities', 'non_current_liabilities',
  'shareholders_equity',
];

/**
 * 合算メトリックの抽出（有利子負債など）
 * 候補タグの値を全て見つけて合計する
 */
function extractAggregateMetric(
  facts: CsvFact[],
  metricKey: MetricKey,
  candidates: string[],
): ExtractionResult {
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

/**
 * コンテキストIDが指定メトリックの検索条件に合致するかを判定する
 *
 * - 連結/単体を問わないメトリック: CurrentYear を含めばOK（Member サフィックス付きは除外）
 * - B/S 項目: 連結 + Instant
 * - P/L・CF 項目: 連結 + Duration/Current
 */
function matchesContext(contextId: string, metricKey: MetricKey): boolean {
  if (!contextId.includes('CurrentYear')) return false;

  if (CONSOLIDATION_AGNOSTIC_METRICS.includes(metricKey)) {
    const isPlainContext = contextId === 'CurrentYearInstant' ||
      contextId === 'CurrentYearInstant_NonConsolidatedMember' ||
      contextId === 'CurrentYearDuration' ||
      contextId === 'CurrentYearDuration_NonConsolidatedMember';
    return isPlainContext || !contextId.includes('Member');
  }

  if (contextId.includes('NonConsolidatedMember')) return false;
  if (BS_METRICS.includes(metricKey)) return contextId.includes('Instant');
  return true;
}

/**
 * 通常メトリックの抽出（優先順位付きフォールバック検索）
 * 候補タグを先頭から順に検索し、最初にヒットした値を採用する
 */
function extractSimpleMetric(
  facts: CsvFact[],
  metricKey: MetricKey,
  candidates: string[],
): ExtractionResult {
  for (const tag of candidates) {
    const matchingFacts = facts.filter(
      (f) => f.localName === tag && matchesContext(f.contextId, metricKey),
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
 * メトリック抽出のディスパッチャー: 合算 or 通常を判定して適切な関数に委譲する
 */
function extractMetric(
  facts: CsvFact[],
  metricKey: MetricKey,
  standard: AccountingStandard,
): ExtractionResult {
  const candidates = METRIC_TAGS[metricKey][standard] ?? METRIC_TAGS[metricKey].JGAAP ?? [];

  if (AGGREGATE_METRICS.includes(metricKey)) {
    return extractAggregateMetric(facts, metricKey, candidates);
  }
  return extractSimpleMetric(facts, metricKey, candidates);
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
    'cash_and_equivalents',
    'current_assets',
    'investments_and_other_assets',
    'current_liabilities',
    'non_current_liabilities',
    'shareholders_equity',
  ];

  const results = metricKeys.map((key) => extractMetric(allFacts, key, standard));

  return {
    accountingStandard: standard,
    periodEnd: periodEnd?.value ?? null,
    results,
  };
}
