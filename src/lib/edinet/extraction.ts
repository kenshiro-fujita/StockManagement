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
  METRIC_KEYS,
  AGGREGATE_METRICS,
  detectAccountingStandard,
  type AccountingStandard,
  type MetricKey,
  type MetricTagCandidates,
} from './taxonomy';

// 既存の import 経路を維持しつつ、定義元は taxonomy.ts に一本化する。
export { METRIC_KEYS } from './taxonomy';

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
  confidence: ExtractionConfidence;
};

/** 抽出値の採用根拠を画面・ログへ伝える信頼度。 */
export type ExtractionConfidence = 'high' | 'medium' | 'low';

/** EDINET 書類をどちらの提供形式から解析したかを記録する。 */
export type ExtractionSourceType = 'csv' | 'xbrl';

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
  sourceType: ExtractionSourceType;
  results: ExtractionResult[];
};

/** ラベルを MetricKey から必ず解決し、抽出経路ごとの表記ずれを防ぐ。 */
function createExtractionResult(
  metricKey: MetricKey,
  details: Omit<ExtractionResult, 'metricKey' | 'label'>
): ExtractionResult {
  return {
    metricKey,
    label: METRIC_LABELS[metricKey],
    ...details,
  };
}

/** 連結/単体を問わないメトリック（企業全体で1つの値しかない） */
const CONSOLIDATION_AGNOSTIC_METRICS: ReadonlySet<MetricKey> = new Set([
  'issued_shares',
  'eps_basic',
]);

/**
 * B/S（貸借対照表）項目: Instant（時点）コンテキストで検索する
 * B/S は「ある時点」の残高なので Instant、P/L・CF は「期間」の累計なので Duration
 */
const BS_METRICS: ReadonlySet<MetricKey> = new Set([
  'total_assets',
  'equity',
  'cash_and_equivalents',
  'current_assets',
  'investments_and_other_assets',
  'current_liabilities',
  'non_current_liabilities',
  'shareholders_equity',
  // 有利子負債の構成要素（借入金・社債・リース債務）も B/S 残高
  'interest_bearing_debt',
]);

/** 合算対象かを毎回配列走査せず判定し、メトリック追加時の意図も明示する。 */
const AGGREGATE_METRIC_SET: ReadonlySet<MetricKey> = new Set(AGGREGATE_METRICS);

/** メトリックのコンテキスト種別 */
type ContextKind = { bs: boolean; agnostic: boolean };

function kindOf(metricKey: MetricKey): ContextKind {
  return {
    bs: BS_METRICS.has(metricKey),
    agnostic: CONSOLIDATION_AGNOSTIC_METRICS.has(metricKey),
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

/** タグ名ごとに Fact を一度だけ索引化し、各メトリックの全件再走査を避ける。 */
type FactIndex = ReadonlyMap<string, readonly NormalizedFact[]>;

function createFactIndex(facts: readonly NormalizedFact[]): FactIndex {
  const index = new Map<string, NormalizedFact[]>();

  for (const fact of facts) {
    const indexedFacts = index.get(fact.localName);
    if (indexedFacts) {
      indexedFacts.push(fact);
    } else {
      index.set(fact.localName, [fact]);
    }
  }

  return index;
}

/** 候補タグの優先順位を保ったまま、条件に合う最初の Fact を返す。 */
function findCandidateFact(
  index: FactIndex,
  candidates: readonly string[],
  matchesContext: (contextId: string) => boolean
): { fact: NormalizedFact; tag: string } | null {
  for (const tag of candidates) {
    const fact = index
      .get(tag)
      ?.find(
        (candidate) =>
          candidate.value != null && matchesContext(candidate.contextId)
      );
    if (fact) return { fact, tag };
  }

  return null;
}

/**
 * 通常メトリックの抽出（プレーン優先の2パス検索）
 */
function extractSimpleMetric(
  index: FactIndex,
  metricKey: MetricKey,
  candidates: readonly string[]
): ExtractionResult {
  const kind = kindOf(metricKey);

  // パス1: プレーンコンテキスト完全一致（セグメント値の混入なし）
  const plainMatch = findCandidateFact(index, candidates, (contextId) =>
    isPlainContext(contextId, kind)
  );
  if (plainMatch) {
    return createExtractionResult(metricKey, {
      value: plainMatch.fact.value,
      matchedTag: plainMatch.tag,
      contextId: plainMatch.fact.contextId,
      confidence: 'high',
    });
  }

  // パス2: 緩い一致。Member 付き（セグメント等）の可能性があるため medium に降格
  const looseMatch = findCandidateFact(index, candidates, (contextId) =>
    matchesLoose(contextId, kind)
  );
  if (looseMatch) {
    return createExtractionResult(metricKey, {
      value: looseMatch.fact.value,
      matchedTag: looseMatch.tag,
      contextId: looseMatch.fact.contextId,
      confidence: 'medium',
    });
  }

  return createExtractionResult(metricKey, {
    value: null,
    matchedTag: null,
    contextId: null,
    confidence: 'low',
  });
}

/**
 * 合算メトリックの抽出（有利子負債など）
 * 候補タグごとにプレーン優先で1件だけ選んで合計する
 * （同一タグの Member 重複を合算すると二重計上になるため）
 */
function extractAggregateMetric(
  index: FactIndex,
  metricKey: MetricKey,
  candidates: readonly string[]
): ExtractionResult {
  const kind = kindOf(metricKey);
  let total = 0;
  let found = false;
  const matchedTags: string[] = [];

  for (const tag of candidates) {
    const tagFacts = index.get(tag) ?? [];
    const fact =
      tagFacts.find(
        (candidate) =>
          candidate.value != null && isPlainContext(candidate.contextId, kind)
      ) ??
      tagFacts.find(
        (candidate) =>
          candidate.value != null && matchesLoose(candidate.contextId, kind)
      );
    if (fact && fact.value != null) {
      total += fact.value;
      found = true;
      matchedTags.push(tag);
    }
  }

  return createExtractionResult(metricKey, {
    value: found ? total : null,
    matchedTag: matchedTags.length > 0 ? matchedTags.join('+') : null,
    contextId: null,
    confidence: found ? 'medium' : 'low',
  });
}

/** 索引化済み Fact から、合算または通常の抽出処理へ振り分ける。 */
function extractMetricFromIndex(
  index: FactIndex,
  metricKey: MetricKey,
  standard: AccountingStandard
): ExtractionResult {
  const tagCandidates: MetricTagCandidates = METRIC_TAGS[metricKey];
  const candidates = tagCandidates[standard] ?? tagCandidates.JGAAP ?? [];

  if (AGGREGATE_METRIC_SET.has(metricKey)) {
    return extractAggregateMetric(index, metricKey, candidates);
  }
  return extractSimpleMetric(index, metricKey, candidates);
}

/** メトリック抽出の公開境界。単一メトリックでも同じ索引ロジックを使用する。 */
export function extractMetric(
  facts: readonly NormalizedFact[],
  metricKey: MetricKey,
  standard: AccountingStandard
): ExtractionResult {
  return extractMetricFromIndex(createFactIndex(facts), metricKey, standard);
}

/** 全メトリックを一括抽出し、Fact の索引は一度だけ生成する。 */
export function extractAllMetrics(
  facts: readonly NormalizedFact[],
  standard: AccountingStandard
): ExtractionResult[] {
  const index = createFactIndex(facts);
  return METRIC_KEYS.map((key) => extractMetricFromIndex(index, key, standard));
}

/**
 * DEI 系の文字列ファクト（会計基準・決算期末日等）を生テキストで取得する
 * value（数値化済み）ではなく rawValue を返すのがポイント
 */
export function findDeiRawValue(
  facts: readonly NormalizedFact[],
  localName: string
): string | null {
  const fact = facts.find((f) => f.localName === localName);
  const raw = fact?.rawValue?.trim();
  return raw ? raw : null;
}

/**
 * パーサーが生成した Fact を、CSV/XBRL 共通の抽出結果へまとめる。
 *
 * 会計基準・決算期・メトリック選択を同じ経路へ通すことで、入力形式による
 * 判定差を作らず、sourceType だけを実際の取得経路として記録する。
 */
export function createExtractionSummary(
  facts: readonly NormalizedFact[],
  sourceType: ExtractionSourceType
): ExtractionSummary {
  const standard = detectAccountingStandard(
    findDeiRawValue(facts, 'AccountingStandardsDEI')
  );

  return {
    accountingStandard: standard,
    periodEnd: findDeiRawValue(facts, 'CurrentFiscalYearEndDateDEI'),
    sourceType,
    results: extractAllMetrics(facts, standard),
  };
}
