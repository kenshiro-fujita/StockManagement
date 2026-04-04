/**
 * EDINET 勘定科目マッピング定義
 *
 * EDINET の XBRL / CSV データから財務指標を抽出する際の、
 * 「どのタグ名で検索すれば目的の数値が見つかるか」を定義するモジュール。
 *
 * 課題:
 * - 同じ「売上高」でも会計基準（J-GAAP / IFRS / US-GAAP）でタグ名が異なる
 * - 同じ基準内でも企業によって使うタグにバリエーションがある（例: Revenue vs NetSales）
 *
 * 解決策:
 * - 会計基準ごとに「候補タグの優先順リスト」を定義
 * - 配列の先頭から検索し、最初にヒットした値を採用する（フォールバック検索）
 *
 * 参考: edinet-mcp の taxonomy.yaml + Claude/Gemini/ChatGPT 3LLM リサーチの統合結果
 */

/** 日本の上場企業が採用する3つの会計基準 */
export type AccountingStandard = 'JGAAP' | 'IFRS' | 'USGAAP';

/** 抽出対象の財務指標キー（financial_data テーブルのカラムに対応） */
export type MetricKey =
  | 'revenue'
  | 'operating_profit'
  | 'net_income_parent'
  | 'total_assets'
  | 'equity'
  | 'operating_cf'
  | 'investing_cf'
  | 'issued_shares'
  | 'eps_basic'
  | 'interest_bearing_debt'
  | 'interest_expense'
  | 'cash_and_equivalents'
  | 'current_assets'
  | 'investments_and_other_assets'
  | 'current_liabilities'
  | 'non_current_liabilities'
  | 'shareholders_equity';

export const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: '売上高',
  operating_profit: '営業利益',
  net_income_parent: '当期純利益（親会社帰属）',
  total_assets: '総資産',
  equity: '純資産',
  operating_cf: '営業CF',
  investing_cf: '投資CF',
  issued_shares: '発行済株式数',
  eps_basic: 'EPS（基本）',
  interest_bearing_debt: '有利子負債',
  interest_expense: '支払利息',
  cash_and_equivalents: '現金及び等価物',
  current_assets: '流動資産',
  investments_and_other_assets: '投資その他の資産',
  current_liabilities: '流動負債',
  non_current_liabilities: '固定負債',
  shareholders_equity: '株主資本',
};

/**
 * 会計基準ごとの候補タグ名（ローカル名、優先順）
 * 配列の先頭から検索し、最初にヒットした値を採用する
 */
export const METRIC_TAGS: Record<MetricKey, Partial<Record<AccountingStandard, string[]>>> = {
  revenue: {
    JGAAP: ['NetSales', 'NetSalesSummaryOfBusinessResults', 'Revenues', 'OperatingRevenues'],
    IFRS: ['Revenue', 'SalesRevenues', 'TotalNetRevenues', 'OperatingRevenues', 'NetSales'],
    USGAAP: ['Revenues', 'SalesRevenueNet'],
  },
  operating_profit: {
    JGAAP: ['OperatingIncome', 'OperatingIncomeSummaryOfBusinessResults'],
    IFRS: ['OperatingProfit', 'OperatingProfitLoss'],
    USGAAP: ['OperatingIncomeLoss'],
  },
  net_income_parent: {
    JGAAP: ['ProfitLossAttributableToOwnersOfParent', 'ProfitLossAttributableToOwnersOfParentSummaryOfBusinessResults'],
    IFRS: ['ProfitAttributableToOwnersOfParent'],
    USGAAP: ['NetIncomeLossAvailableToCommonStockholders'],
  },
  total_assets: {
    JGAAP: ['TotalAssets', 'TotalAssetsSummaryOfBusinessResults'],
    IFRS: ['Assets', 'TotalAssets'],
    USGAAP: ['AssetsTotal'],
  },
  equity: {
    JGAAP: ['NetAssets', 'NetAssetsSummaryOfBusinessResults'],
    IFRS: ['TotalEquity', 'Equity'],
    USGAAP: ['StockholdersEquity'],
  },
  operating_cf: {
    JGAAP: ['CashFlowsFromOperatingActivities'],
    IFRS: ['CashFlowsFromUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivities'],
    USGAAP: ['NetCashProvidedByUsedInOperatingActivities'],
  },
  investing_cf: {
    JGAAP: ['CashFlowsFromInvestingActivities'],
    IFRS: ['CashFlowsFromUsedInInvestingActivities', 'NetCashProvidedByUsedInInvestingActivities'],
    USGAAP: ['NetCashProvidedByUsedInInvestingActivities'],
  },
  issued_shares: {
    JGAAP: ['TotalNumberOfIssuedSharesSummaryOfBusinessResults', 'NumberOfSharesIssuedSharesVotingRights'],
    IFRS: ['NumberOfSharesIssuedSharesVotingRights', 'TotalNumberOfIssuedSharesSummaryOfBusinessResults'],
    USGAAP: ['CommonStockSharesIssued'],
  },
  eps_basic: {
    JGAAP: ['BasicEarningsPerShare', 'BasicEarningsLossPerShare', 'BasicEarningsLossPerShareSummaryOfBusinessResults'],
    IFRS: ['BasicEarningsPerShare', 'BasicEarningsLossPerShare'],
    USGAAP: ['EarningsPerShareBasic'],
  },
  interest_bearing_debt: {
    // 合算用: 個別タグを検索して合計する
    JGAAP: ['ShortTermLoansPayable', 'CurrentPortionOfLongTermLoansPayable', 'LongTermLoansPayable', 'BondsPayable'],
    IFRS: ['ShortTermLoansPayable', 'CurrentPortionOfLongTermLoansPayable', 'LongTermLoansPayable', 'BondsPayable'],
    USGAAP: ['ShortTermLoansPayable', 'LongTermLoansPayable', 'BondsPayable'],
  },
  interest_expense: {
    JGAAP: ['InterestExpenses', 'InterestExpense', 'InterestExpensesNOE'],
    IFRS: ['InterestExpense', 'FinanceCosts'],
    USGAAP: ['InterestExpense'],
  },
  cash_and_equivalents: {
    JGAAP: ['CashAndDeposits', 'CashAndCashEquivalents'],
    IFRS: ['CashAndCashEquivalents', 'CashAndDeposits'],
    USGAAP: ['CashAndCashEquivalentsAtCarryingValue'],
  },
  current_assets: {
    JGAAP: ['CurrentAssets'],
    IFRS: ['CurrentAssets'],
    USGAAP: ['AssetsCurrent'],
  },
  investments_and_other_assets: {
    JGAAP: ['InvestmentsAndOtherAssets'],
    IFRS: ['OtherNonCurrentAssets', 'InvestmentsAndOtherAssets'],
    USGAAP: ['OtherAssetsNoncurrent'],
  },
  current_liabilities: {
    JGAAP: ['CurrentLiabilities'],
    IFRS: ['CurrentLiabilities'],
    USGAAP: ['LiabilitiesCurrent'],
  },
  non_current_liabilities: {
    JGAAP: ['NoncurrentLiabilities', 'FixedLiabilities'],
    IFRS: ['NoncurrentLiabilities'],
    USGAAP: ['LiabilitiesNoncurrent'],
  },
  shareholders_equity: {
    JGAAP: ['ShareholdersEquity', 'StockholdersEquity'],
    IFRS: ['EquityAttributableToOwnersOfParent'],
    USGAAP: ['StockholdersEquity'],
  },
};

/**
 * 合算が必要な特殊メトリックのリスト
 * 有利子負債は XBRL に単一タグが存在しないため、
 * 短期借入金 + 長期借入金 + 社債 等の個別タグを全て足し合わせる
 */
export const AGGREGATE_METRICS: MetricKey[] = ['interest_bearing_debt'];

/**
 * XBRL/CSV 内の AccountingStandardsDEI タグの値から会計基準を判定する
 *
 * 典型的な値: "Japan GAAP", "IFRS", "US GAAP", "JMIS"（修正国際基準）
 * JMIS は実質的に IFRS のタグ体系を使うため、IFRS として扱う。
 * 判定不能な場合は J-GAAP（日本の上場企業で最多）にフォールバックする。
 */
export function detectAccountingStandard(raw: string | null | undefined): AccountingStandard {
  if (!raw) return 'JGAAP';
  const s = raw.toLowerCase();
  if (s.includes('ifrs')) return 'IFRS';
  if (s.includes('us')) return 'USGAAP';
  if (s.includes('jmis')) return 'IFRS';
  return 'JGAAP';
}
