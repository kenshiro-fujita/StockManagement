/**
 * 財務指標の抽出ロジック（CSV / XBRL 共通）
 *
 * CSV パーサーと XBRL パーサーは「Fact の生成」だけを担当し、
 * 「Fact 配列 → 指標」の選択ロジックはこのモジュールに一本化する。
 * 二重実装だと新メトリック追加やコンテキスト判定の修正で片方を取り残すため。
 *
 * コンテキスト選択の方針（セグメント値混入の防止）:
 * 有報では同じタグ（例: NetSales）がセグメント注記
 * （CurrentYearDuration_XXXReportableSegmentsMember 等）にも出現する。
 * 「CurrentYear を含む」だけの緩い一致で先頭を採用すると、
 * 全社売上の代わりにセグメント売上を拾う事故が起こる。
 * そこで2段階で検索する:
 *   パス1: プレーンコンテキスト完全一致（CurrentYearDuration / CurrentYearInstant）→ confidence: high
 *   パス2: 緩い一致（Member 付き等を含む）→ 混入の可能性があるため confidence: medium に降格
 */
import {
  METRIC_TAGS,
  METRIC_LABELS,
  AGGREGATE_METRICS,
  type AccountingStandard,
  type MetricKey,
} from './taxonomy';

/**
 * パーサー非依存の正規化済み Fact
 * - value: 数値化済みの値（非数値ファクトは null）
 * - rawValue: 生テキスト。AccountingStandardsDEI（"IFRS" 等）や
 *   CurrentFiscalYearEndDateDEI（"2025-03-31"）のような文字列ファクトは
 *   数値化すると null に潰れて会計基準判定・年度推定が壊れるため、必ず生値も保持する
 */
export type NormalizedFact = {
  localName: string;
  contextId: string;
  unitId: string;
  value: number | null;
  rawValue: string;
};

/**
 * 1つの財務指標の抽出結果
 * - matchedTag: 実際にマッチしたXBRLタグ名（ログ・変更検出に使用）
 * - confidence: 抽出の信頼度
 *   high=プレーンコンテキストで一致, medium=合算または緩い一致（混入の可能性）, low=未検出
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
 * - sourceType: どの経路で抽出したか（FR15: 抽出ログに実値を記録するため。
 *   以前は 'csv' がハードコードされており XBRL フォールバック時のログが不正確だった）
 */
export type ExtractionSummary = {
  accountingStandard: AccountingStandard;
  periodEnd: string | null;
  sourceType: 'csv' | 'xbrl';
  results: ExtractionResult[];
};

/** 抽出対象の全メトリック（financial_data のカラムに対応） */
export const METRIC_KEYS: MetricKey[] = [
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

/** 連結/単体を問わないメトリック（企業全体で1つの値しかない） */
const CONSOLIDATION_AGNOSTIC_METRICS: MetricKey[] = ['issued_shares', 'eps_basic'];

/**
 * B/S（貸借対照表）項目: Instant（時点）コンテキストで検索する
 * B/S は「ある時点」の残高なので Instant、P/L・CF は「期間」の累計なので Duration
 */
const BS_METRICS: MetricKey[] = [
  'total_assets', 'equity', 'cash_and_equivalents', 'current_assets',
  'investments_and_other_assets', 'current_liabilities', 'non_current_liabilities',
  'shareholders_equity',
  // 有利子負債の構成要素（借入金・社債・リース債務）も B/S 残高
  'interest_bearing_debt',
];

/** メトリックのコンテキスト種別 */
type ContextKind = { bs: boolean; agnostic: boolean };

function kindOf(metricKey: MetricKey): ContextKind {
  return {
    bs: BS_METRICS.includes(metricKey),
    agnostic: CONSOLIDATION_AGNOSTIC_METRICS.includes(metricKey),
  };
}

/** プレーンコンテキスト（Member なしの全社値）に完全一致するか */
function isPlainContext(contextId: string, kind: ContextKind): boolean {
  // 連結/単体不問メトリック（発行済株式数・EPS）は Instant/Duration の両方で
  // 報告されうるため、両プレーン形式＋単体（NonConsolidated）プレーンを許可する
  if (kind.agnostic) {
    return (
      contextId === 'CurrentYearInstant' ||
      contextId === 'CurrentYearDuration' ||
      contextId === 'CurrentYearInstant_NonConsolidatedMember' ||
      contextId === 'CurrentYearDuration_NonConsolidatedMember'
    );
  }
  const plain = kind.bs ? 'CurrentYearInstant' : 'CurrentYearDuration';
  return contextId === plain;
}

/**
 * 緩い一致（従来挙動）。Member 付きコンテキストも通すため、
 * これで採用した値は confidence: medium に降格する
 */
function matchesLoose(contextId: string, kind: ContextKind): boolean {
  if (!contextId.includes('CurrentYear')) return false;
  if (kind.agnostic) return true;
  if (contextId.includes('NonConsolidatedMember')) return false;
  if (kind.bs) return contextId.includes('Instant');
  return true;
}

/**
 * 通常メトリックの抽出（プレーン優先の2パス検索）
 */
function extractSimpleMetric(
  facts: NormalizedFact[],
  metricKey: MetricKey,
  candidates: string[],
): ExtractionResult {
  const kind = kindOf(metricKey);

  // パス1: プレーンコンテキスト完全一致（セグメント値の混入なし）
  for (const tag of candidates) {
    const fact = facts.find(
      (f) => f.localName === tag && f.value != null && isPlainContext(f.contextId, kind),
    );
    if (fact) {
      return {
        metricKey,
        label: METRIC_LABELS[metricKey],
        value: fact.value,
        matchedTag: tag,
        contextId: fact.contextId,
        confidence: 'high',
      };
    }
  }

  // パス2: 緩い一致。Member 付き（セグメント等）の可能性があるため medium に降格
  for (const tag of candidates) {
    const fact = facts.find(
      (f) => f.localName === tag && f.value != null && matchesLoose(f.contextId, kind),
    );
    if (fact) {
      return {
        metricKey,
        label: METRIC_LABELS[metricKey],
        value: fact.value,
        matchedTag: tag,
        contextId: fact.contextId,
        confidence: 'medium',
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
 * 合算メトリックの抽出（有利子負債など）
 * 候補タグごとにプレーン優先で1件だけ選んで合計する
 * （同一タグの Member 重複を合算すると二重計上になるため）
 */
function extractAggregateMetric(
  facts: NormalizedFact[],
  metricKey: MetricKey,
  candidates: string[],
): ExtractionResult {
  const kind = kindOf(metricKey);
  let total = 0;
  let found = false;
  const matchedTags: string[] = [];

  for (const tag of candidates) {
    const tagFacts = facts.filter((f) => f.localName === tag && f.value != null);
    const fact =
      tagFacts.find((f) => isPlainContext(f.contextId, kind)) ??
      tagFacts.find((f) => matchesLoose(f.contextId, kind));
    if (fact && fact.value != null) {
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

/** メトリック抽出のディスパッチャー: 合算 or 通常を判定して委譲する */
export function extractMetric(
  facts: NormalizedFact[],
  metricKey: MetricKey,
  standard: AccountingStandard,
): ExtractionResult {
  const candidates = METRIC_TAGS[metricKey][standard] ?? METRIC_TAGS[metricKey].JGAAP ?? [];

  if (AGGREGATE_METRICS.includes(metricKey)) {
    return extractAggregateMetric(facts, metricKey, candidates);
  }
  return extractSimpleMetric(facts, metricKey, candidates);
}

/** 全メトリックを一括抽出する */
export function extractAllMetrics(
  facts: NormalizedFact[],
  standard: AccountingStandard,
): ExtractionResult[] {
  return METRIC_KEYS.map((key) => extractMetric(facts, key, standard));
}

/**
 * DEI 系の文字列ファクト（会計基準・決算期末日等）を生テキストで取得する
 * value（数値化済み）ではなく rawValue を返すのがポイント
 */
export function findDeiRawValue(
  facts: NormalizedFact[],
  localName: string,
): string | null {
  const fact = facts.find((f) => f.localName === localName);
  const raw = fact?.rawValue?.trim();
  return raw ? raw : null;
}
