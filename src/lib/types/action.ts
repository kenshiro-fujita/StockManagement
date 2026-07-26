/**
 * Server Action の共通戻り値型です。
 *
 * 成功・失敗を `success` で判別できる形に固定し、呼び出し側が
 * `error` や `data` の存在を型安全に扱えるようにします。
 */

/** データを返さない更新系アクションの成功結果です。 */
type ActionSuccess<T> = [T] extends [never]
  ? { success: true; data?: never; error?: never }
  : { success: true; data: T; error?: never };

/**
 * 失敗結果です。
 *
 * AI 調査のように、永続化だけが失敗して生成済みデータを返せる処理だけが、
 * `ActionResult` の2番目の型引数を通して失敗時データを明示します。
 */
type ActionFailure<T> = { success: false; error: string } & ([T] extends [never]
  ? { data?: never }
  : { data?: T });

/** Server Action が返す判別共用体です。 */
export type ActionResult<TSuccess = never, TFailure = never> =
  | ActionSuccess<TSuccess>
  | ActionFailure<TFailure>;
