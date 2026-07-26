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
function ResearchCard({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {content}
      </p>
    </div>
  );
}

export function AIResearchSection({ stockId }: { stockId: string }) {
  const [research, setResearch] = useState<AIResearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isResearching, setIsResearching] = useState(false);

  // 最新結果の取得は再試行可能にし、正常な「履歴なし」と取得失敗を区別します。
  useEffect(() => {
    let cancelled = false;

    void getLatestResearch(stockId)
      .then((result) => {
        if (cancelled) return;

        if (result.success) {
          setResearch(result.data);
          setLoadError(null);
        } else {
          setLoadError(result.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('AI調査履歴の取得に失敗しました');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, stockId]);

  const handleRetryLoad = () => {
    setIsLoading(true);
    setLoadError(null);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const handleResearch = async () => {
    setIsResearching(true);

    try {
      const result = await runAIResearch(stockId);
      // AI生成自体が成功して保存だけ失敗した場合も、生成済み結果は画面に残します。
      if (result.data) {
        setResearch(result.data);
      }

      if (result.success) {
        toast.success('AI調査が完了しました');
      } else {
        toast.error(result.error ?? 'AI調査に失敗しました');
      }
    } catch {
      toast.error('AI調査中にエラーが発生しました');
    } finally {
      setIsResearching(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-12 text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span>AI調査履歴を読み込んでいます...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/40 p-4">
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRetryLoad}
        >
          再試行
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-busy={isResearching}>
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
          <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
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
            <ResearchCard
              title="事業概要"
              content={research.businessOverview}
            />
            <div className="pt-6">
              <ResearchCard
                title="競合環境・業界ポジション"
                content={research.competitivePosition}
              />
            </div>
            <div className="pt-6">
              <ResearchCard
                title="強み・リスク要因"
                content={research.strengthsAndRisks}
              />
            </div>
            <div className="pt-6">
              <ResearchCard title="直近の動向" content={research.recentNews} />
            </div>
          </div>

          <p className="text-xs italic text-muted-foreground">
            この調査結果はAIによる自動生成です。投資判断にはご自身の分析を優先してください。
          </p>
        </div>
      )}
    </div>
  );
}
