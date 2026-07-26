/**
 * DB取得失敗と正常な空データを区別する契約を検証します。
 */
import { describe, expect, it } from 'vitest';
import {
  assertQueriesSucceeded,
  DataAccessError,
} from '@/lib/supabase/query-error';

describe('assertQueriesSucceeded', () => {
  it('全クエリ成功時は何もしない', () => {
    expect(() =>
      assertQueriesSucceeded('銘柄情報の取得', [
        { error: null },
        { error: null },
      ])
    ).not.toThrow();
  });

  it('失敗したクエリをまとめて専用エラーに保持する', () => {
    const firstError = new Error('stocks failed');
    const secondError = new Error('parameters failed');

    try {
      assertQueriesSucceeded('銘柄情報の取得', [
        { error: firstError },
        { error: null },
        { error: secondError },
      ]);
      throw new Error('DataAccessError was not thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DataAccessError);
      expect(error).toMatchObject({
        message: '銘柄情報の取得に失敗しました。',
        operation: '銘柄情報の取得',
        queryErrors: [firstError, secondError],
      });
    }
  });
});
