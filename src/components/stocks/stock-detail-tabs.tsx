'use client';

import { type ReactNode, useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

export function StockDetailTabs({
  overviewContent,
  theoryPriceContent,
  transactionContent,
  financialContent,
  parametersContent,
  edinetContent,
  aiResearchContent,
  defaultTab = 'overview',
}: {
  overviewContent: ReactNode;
  theoryPriceContent: ReactNode;
  transactionContent: ReactNode;
  financialContent: ReactNode;
  parametersContent: ReactNode;
  edinetContent?: ReactNode;
  aiResearchContent?: ReactNode;
  defaultTab?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="overview">概要</TabsTrigger>
        <TabsTrigger value="theory-price">理論株価</TabsTrigger>
        <TabsTrigger value="transactions">取引・損益</TabsTrigger>
        <TabsTrigger value="financial">財務データ</TabsTrigger>
        <TabsTrigger value="parameters">パラメータ</TabsTrigger>
        {edinetContent && <TabsTrigger value="edinet">EDINET</TabsTrigger>}
        {aiResearchContent && <TabsTrigger value="ai-research">AI調査</TabsTrigger>}
      </TabsList>
      {/*
        forceMount + hidden で非アクティブタブも DOM に保持する。
        Radix Tabs のデフォルト（非アクティブをアンマウント）だと、
        財務グリッドの未保存編集がタブ切替で警告なく全て消え、
        EDINET検索・AI調査もタブを開くたびに再フェッチされてしまう
      */}
      <TabsContent forceMount value="overview" className="mt-4 data-[state=inactive]:hidden">
        {overviewContent}
      </TabsContent>
      <TabsContent forceMount value="theory-price" className="mt-4 data-[state=inactive]:hidden">
        {theoryPriceContent}
      </TabsContent>
      <TabsContent forceMount value="transactions" className="mt-4 data-[state=inactive]:hidden">
        {transactionContent}
      </TabsContent>
      <TabsContent forceMount value="financial" className="mt-4 data-[state=inactive]:hidden">
        {financialContent}
      </TabsContent>
      <TabsContent forceMount value="parameters" className="mt-4 data-[state=inactive]:hidden">
        {parametersContent}
      </TabsContent>
      {edinetContent && (
        <TabsContent forceMount value="edinet" className="mt-4 data-[state=inactive]:hidden">
          {edinetContent}
        </TabsContent>
      )}
      {aiResearchContent && (
        <TabsContent forceMount value="ai-research" className="mt-4 data-[state=inactive]:hidden">
          {aiResearchContent}
        </TabsContent>
      )}
    </Tabs>
  );
}
