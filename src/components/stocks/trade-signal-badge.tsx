/**
 * 売買シグナルのバッジ（買い/売り/様子見）
 * ポートフォリオ表など複数箇所で使う共有表示。色だけに依存しないようラベルを併記する。
 */
import type { TradeSignal } from '@/lib/calc/portfolio';

const SIGNAL_CONFIG: Record<TradeSignal, { label: string; className: string }> = {
  buy: { label: '買い時', className: 'bg-green-100 text-green-800 border-green-300' },
  sell: { label: '売り時', className: 'bg-red-100 text-red-800 border-red-300' },
  hold: { label: '様子見', className: 'bg-gray-100 text-gray-700 border-gray-300' },
};

export function TradeSignalBadge({ signal }: { signal: TradeSignal }) {
  const c = SIGNAL_CONFIG[signal];
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
