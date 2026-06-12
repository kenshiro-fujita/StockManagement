/**
 * EDINET APIキーの解決
 *
 * 優先順位: user_settings（設定画面で登録したキー）→ 環境変数 EDINET_API_KEY。
 *
 * 重要: キーをモジュールスコープ等にキャッシュしてはいけない。
 * サーバーレスのウォームインスタンスでは複数ユーザーのリクエストが同一プロセスを
 * 共有するため、キャッシュすると他ユーザーのキーを使い回す事故（誤課金・キー流用）になる。
 * 必ずリクエストごとに解決し、client.ts の各関数へ引数として渡すこと。
 */
import { getUserSetting } from '@/lib/settings/user-settings';

export async function resolveEdinetApiKey(): Promise<string> {
  const userKey = await getUserSetting('edinet_api_key');
  if (userKey) return userKey;

  const envKey = process.env.EDINET_API_KEY;
  if (envKey) return envKey;

  throw new Error('EDINET APIキーが設定されていません。ユーザー設定画面から登録してください。');
}
