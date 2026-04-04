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
  financialContent,
  parametersContent,
  edinetContent,
  aiResearchContent,
  defaultTab = 'overview',
}: {
  overviewContent: ReactNode;
  theoryPriceContent: ReactNode;
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
        <TabsTrigger value="financial">財務データ</TabsTrigger>
        <TabsTrigger value="parameters">パラメータ</TabsTrigger>
        {edinetContent && <TabsTrigger value="edinet">EDINET</TabsTrigger>}
        {aiResearchContent && <TabsTrigger value="ai-research">AI調査</TabsTrigger>}
      </TabsList>
      <TabsContent value="overview" className="mt-4">
        {overviewContent}
      </TabsContent>
      <TabsContent value="theory-price" className="mt-4">
        {theoryPriceContent}
      </TabsContent>
      <TabsContent value="financial" className="mt-4">
        {financialContent}
      </TabsContent>
      <TabsContent value="parameters" className="mt-4">
        {parametersContent}
      </TabsContent>
      {edinetContent && (
        <TabsContent value="edinet" className="mt-4">
          {edinetContent}
        </TabsContent>
      )}
      {aiResearchContent && (
        <TabsContent value="ai-research" className="mt-4">
          {aiResearchContent}
        </TabsContent>
      )}
    </Tabs>
  );
}
