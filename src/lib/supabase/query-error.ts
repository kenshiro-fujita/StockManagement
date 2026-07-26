/**
 * Server Component向けSupabaseクエリの失敗判定を統一します。
 *
 * 読み取り失敗を「データが0件」として扱うと投資データ消失のように見えるため、
 * 内部原因を保持した専用エラーへ変換し、正常な空データと明確に区別します。
 */
type QueryErrorResult = {
  error: unknown;
};

export class DataAccessError extends Error {
  readonly operation: string;
  readonly queryErrors: readonly unknown[];

  constructor(operation: string, queryErrors: readonly unknown[]) {
    super(`${operation}に失敗しました。`);
    this.name = 'DataAccessError';
    this.operation = operation;
    this.queryErrors = queryErrors;
  }
}

/** 並列クエリをまとめて検査し、失敗を黙って空配列へ変換しないようにします。 */
export function assertQueriesSucceeded(
  operation: string,
  results: readonly QueryErrorResult[]
): void {
  const queryErrors = results
    .map(({ error }) => error)
    .filter((error): error is NonNullable<unknown> => error != null);

  if (queryErrors.length > 0) {
    throw new DataAccessError(operation, queryErrors);
  }
}
