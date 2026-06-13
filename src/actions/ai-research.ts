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
import { revalidateStockPaths } from '@/lib/revalidate';
import { getAIProvider, type AIResearchResponse } from '@/lib/ai';
import { AIProviderError } from '@/lib/ai/errors';

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

    // DB に保存。AI 呼び出しは課金済みなので、保存失敗を success: true で
    // 握り潰すと「結果が見えたのに次回開いたら消えている」という不可解な挙動になる。
    // 失敗は明示的にユーザーへ返す（結果自体は data で返すので画面には表示できる）
    const { error: insertError } = await supabase.from('ai_research').insert({
      user_id: user.id,
      stock_id: stockId,
      business_overview: result.businessOverview,
      competitive_position: result.competitivePosition,
      strengths_and_risks: result.strengthsAndRisks,
      recent_news: result.recentNews,
      model: result.model,
      researched_at: result.researchedAt,
    });

    if (insertError) {
      console.error('ai_research insert failed:', insertError);
      return {
        success: false,
        error: '調査は完了しましたが結果の保存に失敗しました。再度お試しください。',
        data: result,
      };
    }

    // business_description も更新（概要タブに表示するため）。
    // 派生的な表示用コピーなので、失敗してもログのみで続行する
    const { error: descError } = await supabase
      .from('stocks')
      .update({ business_description: result.businessOverview })
      .eq('id', stockId);
    if (descError) {
      console.error('business_description update failed:', descError);
    }

    revalidateStockPaths(stockId);
    return { success: true, data: result };
  } catch (error) {
    // プロバイダ層（lib/ai）が正規化した AIProviderError の kind で分岐する。
    // メッセージ文言マッチはSDK更新で静かに壊れるためここでは行わない
    if (error instanceof AIProviderError) {
      switch (error.kind) {
        case 'insufficient_credit':
          return { success: false, error: 'AI APIのクレジット残高が不足しています。プロバイダの管理画面からクレジットを購入してください。' };
        case 'auth':
          return { success: false, error: 'AI APIキーが無効です。ユーザー設定画面で正しいキーを登録してください。' };
        case 'rate_limit':
          return { success: false, error: 'AI APIのレート制限に達しました。しばらくしてから再度お試しください。' };
      }
    }

    // 詳細はサーバーログのみに残し、ユーザーには汎用メッセージを返す（内部情報の露出防止）
    console.error('runAIResearch failed:', error);
    return { success: false, error: 'AI調査に失敗しました。しばらくしてから再度お試しください。' };
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
