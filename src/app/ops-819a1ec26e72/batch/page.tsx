/**
 * 管理画面: EDINET バッチ取得ページ
 *
 * 認証ゲート（cookie アクセス）はレイアウトの AdminGate が Suspense 内で行う。
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
