/**
 * AI プロバイダー抽象層
 *
 * AI 調査機能の LLM バックエンドを抽象化するインターフェース。
 * 現在は Claude API を使用しているが、このインターフェースを実装すれば
 * OpenAI、Gemini、ローカルモデル等に切り替えることができる。
 *
 * 切り替え手順:
 * 1. AIProvider インターフェースを実装した新しいファイルを作成（例: openai.ts）
 * 2. getAIProvider() の返り値を変更する
 * 3. 環境変数を設定する
 */

/** AI プロバイダーへのリクエスト */
export type AIResearchRequest = {
  /** 調査対象の企業名 */
  companyName: string;
  /** 証券コード */
  stockCode: string;
  /** 業種 */
  sector?: string | null;
  /** 事業セグメント */
  businessSegment?: string | null;
  /** 直近の財務サマリー（AI にコンテキストとして渡す） */
  financialSummary?: string | null;
};

/** AI プロバイダーからのレスポンス */
export type AIResearchResponse = {
  /** 事業概要（FR31） */
  businessOverview: string;
  /** 競合環境・業界ポジション */
  competitivePosition: string;
  /** 強み・リスク要因（事実ベース、スコアリングなし。FR33） */
  strengthsAndRisks: string;
  /** 直近のニュース・IR情報のサマリー（FR32） */
  recentNews: string;
  /** 使用したモデル名 */
  model: string;
  /** 調査実行日時 */
  researchedAt: string;
};

/**
 * AI プロバイダーのインターフェース
 * このインターフェースを実装すれば、どの LLM バックエンドにも差し替え可能
 */
export interface AIProvider {
  /** プロバイダー名（例: "claude", "openai", "gemini"） */
  readonly name: string;
  /** 銘柄の定性調査を実行する */
  research(request: AIResearchRequest): Promise<AIResearchResponse>;
}
