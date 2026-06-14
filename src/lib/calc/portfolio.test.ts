import { describe, it, expect } from 'vitest';
import {
  calcPosition,
  calcPositionValuation,
  getTradeSignal,
  idealBuyPriceFromTheory,
  type TransactionInput,
} from './portfolio';

describe('calcPosition（移動平均法）', () => {
  it('複数買い → 売りで平均取得単価と実現損益を正しく算出する', () => {
    const txs: TransactionInput[] = [
      { transaction_type: 'buy', trade_date: '2024-01-10', quantity: 100, unit_price: 1000, fee: 500 },
      { transaction_type: 'buy', trade_date: '2024-03-10', quantity: 100, unit_price: 1200, fee: 500 },
      { transaction_type: 'sell', trade_date: '2024-06-10', quantity: 50, unit_price: 1500, fee: 500 },
    ];
    const p = calcPosition(txs);
    // 買い後: 簿価 100,500 + 120,500 = 221,000 / 200株 → 平均 1,105
    expect(p.averageCost).toBe(1105);
    expect(p.quantity).toBe(150);
    // 実現損益: 受取 75,000 - 500 = 74,500、原価 1,105×50 = 55,250 → +19,250
    expect(p.realizedPL).toBe(19250);
    // 残simの簿価: 1,105 × 150 = 165,750
    expect(p.bookValue).toBe(165750);
    expect(p.totalBoughtQuantity).toBe(200);
    expect(p.totalSoldQuantity).toBe(50);
  });

  it('全株売却で保有0・平均単価null', () => {
    const txs: TransactionInput[] = [
      { transaction_type: 'buy', trade_date: '2024-01-10', quantity: 100, unit_price: 1000, fee: 0 },
      { transaction_type: 'sell', trade_date: '2024-02-10', quantity: 100, unit_price: 1200, fee: 0 },
    ];
    const p = calcPosition(txs);
    expect(p.quantity).toBe(0);
    expect(p.averageCost).toBeNull();
    expect(p.bookValue).toBe(0);
    expect(p.realizedPL).toBe(20000); // (1200-1000)*100
  });

  it('約定日が前後しても日付昇順で集計される', () => {
    const txs: TransactionInput[] = [
      { transaction_type: 'sell', trade_date: '2024-06-10', quantity: 50, unit_price: 1500, fee: 0 },
      { transaction_type: 'buy', trade_date: '2024-01-10', quantity: 100, unit_price: 1000, fee: 0 },
    ];
    const p = calcPosition(txs);
    expect(p.quantity).toBe(50);
    expect(p.averageCost).toBe(1000);
    expect(p.realizedPL).toBe(25000); // (1500-1000)*50
  });

  it('保有を超える売却は保有分までに丸める（不整合データの保険）', () => {
    const txs: TransactionInput[] = [
      { transaction_type: 'buy', trade_date: '2024-01-10', quantity: 100, unit_price: 1000, fee: 0 },
      { transaction_type: 'sell', trade_date: '2024-02-10', quantity: 200, unit_price: 1200, fee: 0 },
    ];
    const p = calcPosition(txs);
    expect(p.quantity).toBe(0);
    expect(p.realizedPL).toBe(20000); // 100株分のみ
  });

  it('取引なしは空ポジション', () => {
    const p = calcPosition([]);
    expect(p.quantity).toBe(0);
    expect(p.averageCost).toBeNull();
    expect(p.realizedPL).toBe(0);
  });
});

describe('calcPositionValuation', () => {
  const position = {
    quantity: 150,
    averageCost: 1105,
    bookValue: 165750,
    realizedPL: 19250,
    totalBoughtQuantity: 200,
    totalSoldQuantity: 50,
  };

  it('現在価格から評価額と未実現損益を算出する', () => {
    const v = calcPositionValuation(position, 1400)!;
    expect(v.marketValue).toBe(210000); // 1400×150
    expect(v.unrealizedPL).toBe(44250); // 210000 - 165750
    expect(v.unrealizedPLPercent).toBe(26.7); // 44250/165750 ≈ 26.7%
  });

  it('現在価格nullまたは未保有はnull', () => {
    expect(calcPositionValuation(position, null)).toBeNull();
    expect(
      calcPositionValuation({ ...position, quantity: 0, bookValue: 0 }, 1400),
    ).toBeNull();
  });
});

describe('getTradeSignal', () => {
  it('現在価格が理想買値以下なら買いシグナル', () => {
    const r = getTradeSignal({ currentPrice: 400, theoryPrice: 1000, idealBuyPrice: 500, hasPosition: false });
    expect(r.signal).toBe('buy');
  });

  it('保有あり・現在価格が理論株価以上なら売りシグナル', () => {
    const r = getTradeSignal({ currentPrice: 1100, theoryPrice: 1000, idealBuyPrice: 500, hasPosition: true });
    expect(r.signal).toBe('sell');
  });

  it('保有なし・割高でも売りにはしない（様子見）', () => {
    const r = getTradeSignal({ currentPrice: 1100, theoryPrice: 1000, idealBuyPrice: 500, hasPosition: false });
    expect(r.signal).toBe('hold');
  });

  it('理想買値と理論株価の間は様子見', () => {
    const r = getTradeSignal({ currentPrice: 700, theoryPrice: 1000, idealBuyPrice: 500, hasPosition: true });
    expect(r.signal).toBe('hold');
  });

  it('理論株価が未算出なら判定しない', () => {
    expect(getTradeSignal({ currentPrice: 700, theoryPrice: null, idealBuyPrice: null, hasPosition: true }).signal).toBe('hold');
    expect(getTradeSignal({ currentPrice: 700, theoryPrice: -100, idealBuyPrice: null, hasPosition: true }).signal).toBe('hold');
  });
});

describe('idealBuyPriceFromTheory', () => {
  it('理論株価の半値を円未満切り捨てで返す', () => {
    expect(idealBuyPriceFromTheory(1001)).toBe(500);
  });
  it('理論株価が0以下ならnull', () => {
    expect(idealBuyPriceFromTheory(0)).toBeNull();
    expect(idealBuyPriceFromTheory(null)).toBeNull();
  });
});
