/**
 * AI 調査結果の表示・実行セクション
 *
 * 銘柄詳細ページの「AI調査」タブに表示される。
 * 「調査を実行」ボタンで Claude API を呼び出し、
 * 4セクション（事業概要/競合環境/強みとリスク/直近の動向）の調査結果を表示する。
 *
 * FR33 準拠: 事実の提示に徹し、スコアリングは行わない。
 */
'use client';

import { useEffect, useState } from 'react';
import { Bot, Loader2, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { runAIResearch, getLatestResearch } from '@/actions/ai-research';
import type { AIResearchResponse } from '@/lib/ai';

/** 調査結果の1セクションを表示するカード */
function ResearchCard({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {content}
      </p>
    </div>
  );
}

export function AIResearchSection({
  stockId,
}: {
  stockId: string;
}) {
  const [research, setResearch] = useState<AIResearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResearching, setIsResearching] = useState(false);

  // 初回ロード: 最新の調査結果を取得
  useEffect(() => {
    (async () => {
      const { data } = await getLatestResearch(stockId);
      setResearch(data);
      setIsLoading(false);
    })();
  }, [stockId]);

  const handleResearch = async () => {
    setIsResearching(true);
    const result = await runAIResearch(stockId);
    setIsResearching(false);

    if (result.success && result.data) {
      setResearch(result.data);
      toast.success('AI調査が完了しました');
    } else {
      toast.error(result.error ?? 'AI調査に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">AI調査</h3>
        </div>
        <Button
          onClick={handleResearch}
          disabled={isResearching}
          variant={research ? 'outline' : 'default'}
        >
          {isResearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              調査中...
            </>
          ) : research ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              再調査
            </>
          ) : (
            <>
              <Bot className="mr-2 h-4 w-4" />
              調査を実行
            </>
          )}
        </Button>
      </div>

      {!research && !isResearching && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bot className="text-muted-foreground mb-4 h-12 w-12" />
          <p className="text-muted-foreground">
            「調査を実行」ボタンを押すと、AIが銘柄の定性分析を行います
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            事実の提示に徹し、投資判断やスコアリングは行いません
          </p>
        </div>
      )}

      {research && (
        <div className="space-y-6">
          {/* メタ情報 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(research.researchedAt).toLocaleString('ja-JP')}
            </span>
            <span className="font-mono">{research.model}</span>
          </div>

          {/* 4セクション */}
          <div className="space-y-6 divide-y">
            <ResearchCard title="事業概要" content={research.businessOverview} />
            <div className="pt-6">
              <ResearchCard title="競合環境・業界ポジション" content={research.competitivePosition} />
            </div>
            <div className="pt-6">
              <ResearchCard title="強み・リスク要因" content={research.strengthsAndRisks} />
            </div>
            <div className="pt-6">
              <ResearchCard title="直近の動向" content={research.recentNews} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            この調査結果はAIによる自動生成です。投資判断にはご自身の分析を優先してください。
          </p>
        </div>
      )}
    </div>
  );
}
