/**
 * ポートフォリオ計算（保有ポジション・実現/未実現損益・売買シグナル）
 *
 * すべて純粋関数。取引履歴（買い/売り）から保有状況と損益を導出し、
 * 理論株価・理想買値と現在価格を突き合わせて売買シグナルを返す。
 *
 * 原価計算は「移動平均法」を採用する（日本の特定口座の既定であり、
 * 証券会社の取得単価表示と一致するため）。手数料は買い時に取得原価へ加算、
 * 売り時に受取額から減算する。
 */
import { roundYen, truncateYen } from './utils';

/** 取引1件（集計に必要な最小限のフィールド） */
export type TransactionInput = {
  transaction_type: 'buy' | 'sell';
  trade_date: string; // YYYY-MM-DD
  quantity: number; // 株数（正）
  unit_price: number; // 円/株
  fee: number; // 手数料（円）
};

/** 保有ポジションの集計結果 */
export type Position = {
  /** 現在の保有株数 */
  quantity: number;
  /** 移動平均取得単価（円/株、手数料込み）。未保有なら null */
  averageCost: number | null;
  /** 現在保有分の簿価（取得原価合計） */
  bookValue: number;
  /** 累計実現損益（売却で確定した損益） */
  realizedPL: number;
  /** 累計買付株数 */
  totalBoughtQuantity: number;
  /** 累計売却株数 */
  totalSoldQuantity: number;
};

/** 現在価格を加味した評価額・未実現損益 */
export type PositionValuation = {
  /** 評価額（現在株価 × 保有株数） */
  marketValue: number;
  /** 未実現損益（評価額 - 簿価） */
  unrealizedPL: number;
  /** 未実現損益率（%） */
  unrealizedPLPercent: number | null;
};

/**
 * 取引履歴から保有ポジションを集計する（移動平均法）。
 * 約定日昇順で処理する（同日は配列順）。
 */
export function calcPosition(transactions: TransactionInput[]): Position {
  // 約定日の昇順で処理（移動平均は順序に依存するため）
  const sorted = [...transactions].sort((a, b) =>
    a.trade_date < b.trade_date ? -1 : a.trade_date > b.trade_date ? 1 : 0,
  );

  let quantity = 0;
  let bookValue = 0; // 現在保有分の簿価合計
  let realizedPL = 0;
  let totalBought = 0;
  let totalSold = 0;

  for (const tx of sorted) {
    if (tx.transaction_type === 'buy') {
      // 取得原価 = 株数×単価 + 手数料 を簿価に加算
      bookValue += tx.quantity * tx.unit_price + tx.fee;
      quantity += tx.quantity;
      totalBought += tx.quantity;
    } else {
      // 売り: 保有を超える売却は保有分までに丸める（データ不整合時の保険）
      const sellQty = Math.min(tx.quantity, quantity);
      const avgCost = quantity > 0 ? bookValue / quantity : 0;
      // 受取額 = 株数×単価 - 手数料、原価 = 平均取得単価 × 売却株数
      const proceeds = sellQty * tx.unit_price - tx.fee;
      const costBasis = avgCost * sellQty;
      realizedPL += proceeds - costBasis;
      // 簿価は平均単価 × 残数量で更新（平均単価自体は売却で変わらない）
      quantity -= sellQty;
      bookValue = avgCost * quantity;
      totalSold += sellQty;
    }
  }

  return {
    quantity,
    averageCost: quantity > 0 ? roundYen(bookValue / quantity) : null,
    bookValue: roundYen(bookValue),
    realizedPL: roundYen(realizedPL),
    totalBoughtQuantity: totalBought,
    totalSoldQuantity: totalSold,
  };
}

/** 現在価格から評価額・未実現損益を算出する */
export function calcPositionValuation(
  position: Position,
  currentPrice: number | null,
): PositionValuation | null {
  if (currentPrice == null || position.quantity <= 0) return null;

  const marketValue = roundYen(currentPrice * position.quantity);
  const unrealizedPL = roundYen(marketValue - position.bookValue);
  const unrealizedPLPercent =
    position.bookValue > 0
      ? Math.round((unrealizedPL / position.bookValue) * 1000) / 10
      : null;

  return { marketValue, unrealizedPL, unrealizedPLPercent };
}

/** 売買シグナルの種別 */
export type TradeSignal = 'buy' | 'sell' | 'hold';

export type TradeSignalResult = {
  signal: TradeSignal;
  /** 表示用の理由 */
  reason: string;
};

/**
 * 売買シグナルを判定する（中長期投資のコア: 安く買い・高く売る）。
 *
 * - 買い: 現在価格が理想買値（理論株価 × 0.5）以下 → 十分に割安
 * - 売り: 保有あり かつ 現在価格が理論株価以上 → 十分に割高（利確検討）
 * - 様子見: それ以外
 *
 * 理論株価が算出不可（null・0以下）の場合は判定しない（hold + 理由）。
 */
export function getTradeSignal(params: {
  currentPrice: number | null;
  theoryPrice: number | null;
  idealBuyPrice: number | null;
  hasPosition: boolean;
}): TradeSignalResult {
  const { currentPrice, theoryPrice, idealBuyPrice, hasPosition } = params;

  if (currentPrice == null || theoryPrice == null || theoryPrice <= 0) {
    return { signal: 'hold', reason: '理論株価または現在株価が未算出のため判定できません' };
  }

  if (idealBuyPrice != null && currentPrice <= idealBuyPrice) {
    return {
      signal: 'buy',
      reason: `現在株価が理想買値（${idealBuyPrice.toLocaleString('ja-JP')}円）以下です。十分に割安なため買い増しを検討できます。`,
    };
  }

  if (hasPosition && currentPrice >= theoryPrice) {
    return {
      signal: 'sell',
      reason: `現在株価が理論株価（${theoryPrice.toLocaleString('ja-JP')}円）以上です。割高水準のため利益確定（売却）を検討できます。`,
    };
  }

  return {
    signal: 'hold',
    reason: hasPosition
      ? '理想買値と理論株価の間です。保有を継続して様子見が妥当です。'
      : '理想買値までは下がっていません。押し目を待つのが妥当です。',
  };
}

/**
 * 理想買値（理論株価 × 割引係数）。安全率計算の calcIdealBuyPrice と同じ思想だが、
 * シグナル判定用に値だけ欲しいケースで使う軽量版。理論株価が0以下なら null。
 */
export function idealBuyPriceFromTheory(
  theoryPrice: number | null,
  discountFactor = 0.5,
): number | null {
  if (theoryPrice == null || theoryPrice <= 0) return null;
  return truncateYen(theoryPrice * discountFactor);
}
