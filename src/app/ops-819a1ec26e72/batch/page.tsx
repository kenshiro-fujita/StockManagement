/**
 * 管理画面: EDINET バッチ取得ページ
 */
import { EdinetBatchSection } from '@/components/settings/edinet-batch';

export default function AdminBatchPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">EDINET バッチ取得</h1>
      <EdinetBatchSection />
    </div>
  );
}
