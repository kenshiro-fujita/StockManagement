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
  financialContent,
  defaultTab = 'overview',
}: {
  overviewContent: ReactNode;
  financialContent: ReactNode;
  defaultTab?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="overview">概要</TabsTrigger>
        <TabsTrigger value="financial">財務データ</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4">
        {overviewContent}
      </TabsContent>
      <TabsContent value="financial" className="mt-4">
        {financialContent}
      </TabsContent>
    </Tabs>
  );
}
