/**
 * AI 調査の Server Actions
 *
 * - runAIResearch: 銘柄の定性調査を AI で実行し、結果を DB に保存する
 * - getLatestResearch: 銘柄の最新の調査結果を取得する
 *
 * AI プロバイダーは lib/ai/ で抽象化されており、
 * Claude 以外に切り替える場合は lib/ai/index.ts の getAIProvider() を変更するだけでよい。
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getAIProvider, type AIResearchResponse } from '@/lib/ai';

/**
 * 金額（円）を「N百万円」形式に整形する。
 * null は「データなし」と表記する — EDINET 取込経由の行は値が null になりうるため、
 * `null / 1_000_000 === 0` で「売上0百万円」という誤った事実が AI に渡るのを防ぐ
 */
function formatMillionYen(value: number | null): string {
  if (value == null) return 'データなし';
  return `${(value / 1_000_000).toFixed(0)}百万円`;
}

/** AI に渡す財務サマリーを組み立てる（直近3期分） */
async function buildFinancialSummary(
  stockId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('financial_data')
    .select('fiscal_year, revenue, operating_income, net_income, total_assets')
    .eq('stock_id', stockId)
    .order('fiscal_year', { ascending: false })
    .limit(3);

  if (!data || data.length === 0) return null;

  return data
    .map(
      (fd: { fiscal_year: number; revenue: number | null; operating_income: number | null; net_income: number | null; total_assets: number | null }) =>
        `${fd.fiscal_year}年: 売上${formatMillionYen(fd.revenue)}, ` +
        `営業利益${formatMillionYen(fd.operating_income)}, ` +
        `純利益${formatMillionYen(fd.net_income)}, ` +
        `総資産${formatMillionYen(fd.total_assets)}`,
    )
    .join('\n');
}

/** 銘柄の定性調査を AI で実行し、結果を DB に保存する */
export async function runAIResearch(
  stockId: string,
): Promise<{ success: boolean; error?: string; data?: AIResearchResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '認証が必要です' };
  }

  // 銘柄情報を取得
  const { data: stock } = await supabase
    .from('stocks')
    .select('stock_code, company_name, sector, business_segment')
    .eq('id', stockId)
    .single();

  if (!stock) {
    return { success: false, error: '銘柄が見つかりません' };
  }

  try {
    const financialSummary = await buildFinancialSummary(stockId);
    const provider = await getAIProvider();

    const result = await provider.research({
      companyName: stock.company_name,
      stockCode: stock.stock_code,
      sector: stock.sector,
      businessSegment: stock.business_segment,
      financialSummary,
    });

    // DB に保存
    await supabase.from('ai_research').insert({
      user_id: user.id,
      stock_id: stockId,
      business_overview: result.businessOverview,
      competitive_position: result.competitivePosition,
      strengths_and_risks: result.strengthsAndRisks,
      recent_news: result.recentNews,
      model: result.model,
      researched_at: result.researchedAt,
    });

    // business_description も更新（概要タブに表示するため）
    await supabase
      .from('stocks')
      .update({ business_description: result.businessOverview })
      .eq('id', stockId);

    revalidatePath('/stocks');
    return { success: true, data: result };
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'AI調査に失敗しました';

    // Anthropic API のエラーをユーザーにわかりやすく翻訳
    if (raw.includes('credit balance is too low')) {
      return { success: false, error: 'Anthropic APIのクレジット残高が不足しています。console.anthropic.com の Plans & Billing からクレジットを購入してください。' };
    }
    if (raw.includes('invalid_api_key') || raw.includes('401')) {
      return { success: false, error: 'Anthropic APIキーが無効です。ユーザー設定画面で正しいキーを登録してください。' };
    }
    if (raw.includes('rate_limit')) {
      return { success: false, error: 'Anthropic APIのレート制限に達しました。しばらくしてから再度お試しください。' };
    }

    return { success: false, error: raw };
  }
}

/** 銘柄の最新の調査結果を取得する */
export async function getLatestResearch(
  stockId: string,
): Promise<{ data: AIResearchResponse | null }> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('ai_research')
    .select('business_overview, competitive_position, strengths_and_risks, recent_news, model, researched_at')
    .eq('stock_id', stockId)
    .order('researched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { data: null };

  return {
    data: {
      businessOverview: data.business_overview,
      competitivePosition: data.competitive_position,
      strengthsAndRisks: data.strengths_and_risks,
      recentNews: data.recent_news,
      model: data.model,
      researchedAt: data.researched_at,
    },
  };
}
