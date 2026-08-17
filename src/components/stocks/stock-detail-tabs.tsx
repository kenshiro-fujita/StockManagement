/**
 * 銘柄詳細の分析領域をタブで切り替え、訪問済みパネルの状態を保持します。
 *
 * 未訪問タブは遅延マウントして不要なDB/AI取得を避け、一度開いた後は
 * フォームの未保存値や取得結果を失わないようDOMへ残します。
 */
'use client';

import { type ReactNode, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type StockDetailTab =
  | 'overview'
  | 'theory-price'
  | 'transactions'
  | 'financial'
  | 'parameters'
  | 'ai-research';

/**
 * 常に公開するタブを一か所に集約します。
 *
 * 表示順とタブ名が別々に管理されると、導線を変更した際にトリガーだけが
 * 古いまま残るため、トリガーの描画と回帰テストで同じ定義を利用します。
 */
export const STOCK_DETAIL_PUBLIC_TABS = [
  { value: 'overview', label: '概要' },
  { value: 'theory-price', label: '理論株価' },
  { value: 'transactions', label: '取引・損益' },
  { value: 'financial', label: '財務データ' },
  { value: 'parameters', label: 'パラメータ' },
] as const satisfies readonly { value: StockDetailTab; label: string }[];

function PersistentTabPanel({
  children,
  mounted,
  value,
}: {
  children: ReactNode;
  mounted: boolean;
  value: StockDetailTab;
}) {
  if (!mounted) return null;

  return (
    <TabsContent
      forceMount
      value={value}
      className="mt-4 data-[state=inactive]:hidden"
    >
      {children}
    </TabsContent>
  );
}

export function StockDetailTabs({
  overviewContent,
  theoryPriceContent,
  transactionContent,
  financialContent,
  parametersContent,
  aiResearchContent,
  defaultTab = 'overview',
}: {
  overviewContent: ReactNode;
  theoryPriceContent: ReactNode;
  transactionContent: ReactNode;
  financialContent: ReactNode;
  parametersContent: ReactNode;
  aiResearchContent?: ReactNode;
  defaultTab?: StockDetailTab;
}) {
  const [activeTab, setActiveTab] = useState<StockDetailTab>(defaultTab);
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<StockDetailTab>>(
    () => new Set([defaultTab])
  );

  /** Radix が返す値をこのコンポーネントの閉じたタブ集合へ正規化します。 */
  const handleTabChange = (value: string) => {
    const nextTab = value as StockDetailTab;
    setActiveTab(nextTab);
    setVisitedTabs((current) => {
      if (current.has(nextTab)) return current;
      return new Set([...current, nextTab]);
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="max-w-full justify-start overflow-x-auto">
        {STOCK_DETAIL_PUBLIC_TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
        {aiResearchContent && (
          <TabsTrigger value="ai-research">AI調査</TabsTrigger>
        )}
      </TabsList>
      <PersistentTabPanel
        mounted={visitedTabs.has('overview')}
        value="overview"
      >
        {overviewContent}
      </PersistentTabPanel>
      <PersistentTabPanel
        mounted={visitedTabs.has('theory-price')}
        value="theory-price"
      >
        {theoryPriceContent}
      </PersistentTabPanel>
      <PersistentTabPanel
        mounted={visitedTabs.has('transactions')}
        value="transactions"
      >
        {transactionContent}
      </PersistentTabPanel>
      <PersistentTabPanel
        mounted={visitedTabs.has('financial')}
        value="financial"
      >
        {financialContent}
      </PersistentTabPanel>
      <PersistentTabPanel
        mounted={visitedTabs.has('parameters')}
        value="parameters"
      >
        {parametersContent}
      </PersistentTabPanel>
      {aiResearchContent && (
        <PersistentTabPanel
          mounted={visitedTabs.has('ai-research')}
          value="ai-research"
        >
          {aiResearchContent}
        </PersistentTabPanel>
      )}
    </Tabs>
  );
}
