/**
 * AI プロバイダ非依存のエラー型
 *
 * SDK 固有の例外（Anthropic.AuthenticationError 等）やエラーメッセージ文言への
 * 依存をアクション層に漏らさないための正規化レイヤー。
 * アクション層は kind で分岐するだけでよく、プロバイダを差し替えても
 * エラーハンドリングのコードは変わらない。
 */

/** プロバイダ非依存のエラー分類 */
export type AIErrorKind =
  | 'auth' // APIキーが無効・未認証
  | 'rate_limit' // レート制限
  | 'insufficient_credit' // クレジット・残高不足
  | 'unknown'; // その他（詳細はサーバーログのみに残す）

export class AIProviderError extends Error {
  readonly kind: AIErrorKind;

  constructor(kind: AIErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AIProviderError';
    this.kind = kind;
  }
}
