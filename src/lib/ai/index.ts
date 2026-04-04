/**
 * AI プロバイダーのエントリーポイント
 *
 * 現在のプロバイダーを返すファクトリ関数。
 * プロバイダーを切り替えるにはこの関数の中身を変えるだけでよい。
 */
import type { AIProvider } from './provider';
import { ClaudeProvider } from './claude';

/**
 * 現在の AI プロバイダーを取得する
 *
 * 将来的に環境変数（AI_PROVIDER=claude|openai|gemini）で
 * 切り替える拡張も可能だが、現時点では Claude 固定。
 */
export function getAIProvider(): AIProvider {
  return new ClaudeProvider();
}

export type { AIProvider, AIResearchRequest, AIResearchResponse } from './provider';
