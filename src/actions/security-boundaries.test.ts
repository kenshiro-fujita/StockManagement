/**
 * Server Action の直接POSTを想定し、入力・認証・所有権の境界を回帰検証します。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedContext: vi.fn(),
  checkStockOwnership: vi.fn(),
  findOwnedStock: vi.fn(),
  revalidateStockPaths: vi.fn(),
  fetchDocumentList: vi.fn(),
  searchAnnualReports: vi.fn(),
  fetchDocumentData: vi.fn(),
  resolveEdinetApiKey: vi.fn(),
}));

vi.mock('@/lib/supabase/auth', () => ({
  getAuthenticatedContext: mocks.getAuthenticatedContext,
}));

vi.mock('@/lib/supabase/ownership', () => ({
  checkStockOwnership: mocks.checkStockOwnership,
  findOwnedStock: mocks.findOwnedStock,
}));

vi.mock('@/lib/revalidate', () => ({
  revalidateStockPaths: mocks.revalidateStockPaths,
}));

vi.mock('@/lib/edinet/client', () => ({
  fetchDocumentList: mocks.fetchDocumentList,
  searchAnnualReports: mocks.searchAnnualReports,
  fetchDocumentData: mocks.fetchDocumentData,
}));

vi.mock('@/lib/edinet/api-key', () => ({
  resolveEdinetApiKey: mocks.resolveEdinetApiKey,
}));

import {
  checkExistingFinancialData,
  extractFinancialData,
  saveEdinetDocument,
  saveExtractedData,
} from '@/actions/edinet';
import { getLatestResearch } from '@/actions/ai-research';
import { updateParameters } from '@/actions/parameters';
import { updateFinancialData } from '@/actions/financial-data';
import { lookupStockByCode } from '@/actions/stock-lookup';
import { deleteTransaction, listTransactions } from '@/actions/transactions';

const STOCK_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_STOCK_ID = '76da86b1-0df1-4ae4-8c84-e0a07cba6cd9';
const FINANCIAL_DATA_ID = 'f54fa4c1-d13f-42b6-a442-934cc28eaa78';

const extraction = {
  accountingStandard: 'JGAAP' as const,
  periodEnd: '2026-03-31',
  sourceType: 'csv' as const,
  results: [
    {
      metricKey: 'revenue' as const,
      label: '売上高',
      value: 100,
      matchedTag: 'NetSales',
      contextId: 'CurrentYearDuration',
      confidence: 'high' as const,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('入力境界', () => {
  it('不正な証券コードでは認証や外部APIへ進まない', async () => {
    await expect(lookupStockByCode('../7')).resolves.toEqual({
      success: false,
      error: '4桁の証券コードで入力してください',
    });
    expect(mocks.getAuthenticatedContext).not.toHaveBeenCalled();
    expect(mocks.fetchDocumentList).not.toHaveBeenCalled();
  });

  it('不正なEDINET書類IDでは外部APIへ進まない', async () => {
    await expect(extractFinancialData('../secret')).resolves.toEqual({
      success: false,
      error: '書類情報が不正です',
    });
    expect(mocks.getAuthenticatedContext).not.toHaveBeenCalled();
    expect(mocks.fetchDocumentData).not.toHaveBeenCalled();
  });

  it('取引削除のIDを両方とも検証してから認証へ進む', async () => {
    await expect(deleteTransaction('not-a-uuid', STOCK_ID)).resolves.toEqual({
      success: false,
      error: '入力内容に誤りがあります',
    });
    expect(mocks.getAuthenticatedContext).not.toHaveBeenCalled();
  });

  it('取引一覧でも不正な銘柄IDを正常な空配列に見せない', async () => {
    await expect(listTransactions('not-a-uuid')).resolves.toEqual({
      success: false,
      error: '無効な銘柄IDです',
    });
    expect(mocks.getAuthenticatedContext).not.toHaveBeenCalled();
  });

  it('改変された重複指標をDB保存前に拒否する', async () => {
    const [firstResult] = extraction.results;
    if (!firstResult) {
      throw new Error('重複検証には抽出済み指標が1件必要です');
    }

    const duplicated = {
      ...extraction,
      results: [firstResult, firstResult],
    };

    await expect(
      saveExtractedData(STOCK_ID, duplicated, 2026, 'S100AB12')
    ).resolves.toEqual({
      success: false,
      error: '抽出データが不正です',
    });
    expect(mocks.getAuthenticatedContext).not.toHaveBeenCalled();
  });

  it('引数とフォーム内で異なる銘柄IDを更新前に拒否する', async () => {
    await expect(
      updateParameters(STOCK_ID, {
        stock_id: OTHER_STOCK_ID,
        discount_rate: 0.08,
        growth_rate: 0.02,
        tax_rate: 0.3,
        cap_multiplier: 10,
      })
    ).resolves.toEqual({
      success: false,
      error: '銘柄IDが一致しません',
    });
    expect(mocks.getAuthenticatedContext).not.toHaveBeenCalled();
  });
});

describe('認証・所有権境界', () => {
  it('未認証では銘柄検索の外部APIフォールバックを実行しない', async () => {
    mocks.getAuthenticatedContext.mockResolvedValue(null);

    await expect(lookupStockByCode('7203')).resolves.toEqual({
      success: false,
      error: '認証が必要です',
    });
    expect(mocks.fetchDocumentList).not.toHaveBeenCalled();
  });

  it('未認証のAI調査取得を未データと区別する', async () => {
    mocks.getAuthenticatedContext.mockResolvedValue(null);

    await expect(getLatestResearch(STOCK_ID)).resolves.toEqual({
      success: false,
      error: '認証が必要です',
    });
  });

  it('所有していない銘柄には抽出結果を保存しない', async () => {
    const supabase = { from: vi.fn() };
    mocks.getAuthenticatedContext.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });
    mocks.checkStockOwnership.mockResolvedValue('not_found');

    await expect(
      saveExtractedData(STOCK_ID, extraction, 2026, 'S100AB12')
    ).resolves.toEqual({
      success: false,
      error: '対象の銘柄が見つかりません',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('別企業のEDINET書類を対象銘柄へ保存しない', async () => {
    const supabase = { from: vi.fn() };
    mocks.getAuthenticatedContext.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });
    mocks.findOwnedStock.mockResolvedValue({
      status: 'owned',
      stock: { id: STOCK_ID, stock_code: '7203' },
    });

    await expect(
      saveEdinetDocument(STOCK_ID, {
        docID: 'S100AB12',
        secCode: '67580',
        edinetCode: 'E01737',
        filerName: '別企業株式会社',
        periodStart: '2025-04-01',
        periodEnd: '2026-03-31',
        submitDateTime: '2026-06-25T09:00:00',
        docDescription: '有価証券報告書',
        xbrlFlag: true,
        csvFlag: true,
      })
    ).resolves.toEqual({
      success: false,
      error: '書類の証券コードが対象銘柄と一致しません',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('存在確認クエリにもuser_idを明示してRLSと二重化する', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'financial-1' },
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const supabase = { from: vi.fn().mockReturnValue(query) };
    mocks.getAuthenticatedContext.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });

    await expect(
      checkExistingFinancialData(STOCK_ID, 2026, 'FY', 'consolidated')
    ).resolves.toEqual({ success: true, data: true });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('取引一覧のDB障害を正常な0件と区別する', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: null,
      error: new Error('database unavailable'),
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };
    mocks.getAuthenticatedContext.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });

    await expect(listTransactions(STOCK_ID)).resolves.toEqual({
      success: false,
      error: '取引履歴の取得に失敗しました',
    });
    expect(consoleError).toHaveBeenCalledWith(
      'listTransactions failed:',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it('財務グリッドの全補助項目を正しい単位で更新する', async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: FINANCIAL_DATA_ID }],
        error: null,
      }),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const supabase = { from: vi.fn().mockReturnValue(query) };
    mocks.getAuthenticatedContext.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });
    mocks.checkStockOwnership.mockResolvedValue('owned');

    await expect(
      updateFinancialData(FINANCIAL_DATA_ID, {
        stock_id: STOCK_ID,
        fiscal_year: 2026,
        fiscal_quarter: 'FY',
        consolidation_type: 'consolidated',
        revenue: '100',
        operating_income: '20',
        net_income: '10',
        total_assets: '500',
        equity: '250',
        cash_and_equivalents: '50',
        current_assets: '200',
        investments_and_other_assets: '75',
        current_liabilities: '80',
        non_current_liabilities: '120',
        shareholders_equity: '240',
        beta: '1.25',
        input_unit: 'million',
      })
    ).resolves.toEqual({ success: true });

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        cash_and_equivalents: 50_000_000,
        current_assets: 200_000_000,
        investments_and_other_assets: 75_000_000,
        current_liabilities: 80_000_000,
        non_current_liabilities: 120_000_000,
        shareholders_equity: 240_000_000,
        beta: 1.25,
      })
    );
  });
});
