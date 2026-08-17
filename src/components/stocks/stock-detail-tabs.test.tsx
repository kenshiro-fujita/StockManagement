/**
 * 銘柄詳細の公開タブ構成を検証します。
 *
 * このプロジェクトのVitestはNode環境のため、描画専用の依存関係を増やさず、
 * 実際のタブトリガーが参照する公開定義を回帰対象にします。
 */
import { describe, expect, it } from 'vitest';

import { STOCK_DETAIL_PUBLIC_TABS } from './stock-detail-tabs';

describe('StockDetailTabs の公開タブ', () => {
  it('EDINETを含めず、基本タブを利用者向けの順で公開する', () => {
    expect(STOCK_DETAIL_PUBLIC_TABS).toEqual([
      { value: 'overview', label: '概要' },
      { value: 'theory-price', label: '理論株価' },
      { value: 'transactions', label: '取引・損益' },
      { value: 'financial', label: '財務データ' },
      { value: 'parameters', label: 'パラメータ' },
    ]);
  });
});
