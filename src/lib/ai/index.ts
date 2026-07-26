/**
 * AI プロバイダーのエントリーポイント
 *
 * APIキーの解決順序:
 * 1. user_settings テーブル（設定画面で保存したキー）
 * 2. 環境変数 ANTHROPIC_API_KEY（フォールバック）
 */
import type { AIProvider } from './provider';
import { ClaudeProvider } from './claude';
import { getUserSetting } from '@/lib/settings/user-settings';

/**
 * 現在の AI プロバイダーを取得する
 * user_settings のキーを優先し、なければ環境変数にフォールバック
 */
export async function getAIProvider(): Promise<AIProvider> {
  const userKey = await getUserSetting('anthropic_api_key');
  const apiKey = userKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Anthropic APIキーが設定されていません。ユーザー設定画面から登録してください。'
    );
  }

  return new ClaudeProvider(apiKey);
}

export type {
  AIProvider,
  AIResearchRequest,
  AIResearchResponse,
} from './provider';
