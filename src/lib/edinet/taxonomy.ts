/**
 * EDINET 勘定科目マッピング
 * edinet-mcp の taxonomy.yaml + 3LLMリサーチの統合結果
 */

export type AccountingStandard = 'JGAAP' | 'IFRS' | 'USGAAP';

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
  | 'interest_expense';

export const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: '売上高',
  operating_profit: '営業利益',
  net_income_parent: '当期純利益（親会社帰属）',
  total_assets: '総資産',
  equity: '自己資本/純資産',
  operating_cf: '営業CF',
  investing_cf: '投資CF',
  issued_shares: '発行済株式数',
  eps_basic: 'EPS（基本）',
  interest_bearing_debt: '有利子負債',
  interest_expense: '支払利息',
};

/**
 * 会計基準ごとの候補タグ名（ローカル名、優先順）
 * 配列の先頭から検索し、最初にヒットした値を採用する
 */
export const METRIC_TAGS: Record<MetricKey, Partial<Record<AccountingStandard, string[]>>> = {
  revenue: {
    JGAAP: ['NetSales', 'Revenues', 'OperatingRevenues'],
    IFRS: ['Revenue', 'SalesRevenues', 'TotalNetRevenues', 'OperatingRevenues', 'NetSales'],
    USGAAP: ['Revenues', 'SalesRevenueNet'],
  },
  operating_profit: {
    JGAAP: ['OperatingIncome'],
    IFRS: ['OperatingProfit', 'OperatingProfitLoss'],
    USGAAP: ['OperatingIncomeLoss'],
  },
  net_income_parent: {
    JGAAP: ['ProfitLossAttributableToOwnersOfParent'],
    IFRS: ['ProfitAttributableToOwnersOfParent'],
    USGAAP: ['NetIncomeLossAvailableToCommonStockholders'],
  },
  total_assets: {
    JGAAP: ['TotalAssets'],
    IFRS: ['Assets', 'TotalAssets'],
    USGAAP: ['AssetsTotal'],
  },
  equity: {
    JGAAP: ['NetAssets'],
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
    JGAAP: ['NumberOfSharesIssuedSharesVotingRights', 'TotalNumberOfIssuedSharesSummaryOfBusinessResults'],
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
    JGAAP: ['InterestExpenses', 'InterestExpense'],
    IFRS: ['InterestExpense', 'FinanceCosts'],
    USGAAP: ['InterestExpense'],
  },
};

/** 有利子負債は合算が必要な特殊メトリック */
export const AGGREGATE_METRICS: MetricKey[] = ['interest_bearing_debt'];

/**
 * AccountingStandardsDEI の値から会計基準を判定する
 */
export function detectAccountingStandard(raw: string | null | undefined): AccountingStandard {
  if (!raw) return 'JGAAP';
  const s = raw.toLowerCase();
  if (s.includes('ifrs')) return 'IFRS';
  if (s.includes('us')) return 'USGAAP';
  if (s.includes('jmis')) return 'IFRS'; // 修正国際基準はIFRSとして扱う
  return 'JGAAP';
}
