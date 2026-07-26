/**
 * 画面遷移時の共通ローディング表示です。
 *
 * 視覚的なスピナーだけでは支援技術に状態が伝わらないため、
 * 読み上げ可能な status とメッセージを一体で提供します。
 */
import { Loader2 } from 'lucide-react';

export function PageLoading({ label = '読み込み中...' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center py-20"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-8 w-8 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
      <span className="ml-3 text-muted-foreground">{label}</span>
    </div>
  );
}
