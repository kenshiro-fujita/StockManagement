/**
 * Claude API 実装（AIProvider インターフェース準拠）
 *
 * Anthropic SDK を使用して銘柄の定性調査を行う。
 * 環境変数 ANTHROPIC_API_KEY が必要。
 *
 * プロンプト設計の方針（FR33 準拠）:
 * - 事実の提示に徹し、スコアリングや投資判断は行わない
 * - 出所が明確な情報のみを記載するよう指示
 * - 構造化された4セクションで回答を返させる
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  AIResearchRequest,
  AIResearchResponse,
} from './provider';
import { AIProviderError } from './errors';

/** Claude に送るシステムプロンプト */
const SYSTEM_PROMPT = `あなたは日本の上場企業を調査するリサーチアナリストです。
以下のルールを厳守してください：
- 事実の提示に徹し、投資判断やスコアリングは絶対に行わないこと
- 出所が不明確な情報は「未確認」と明記すること
- 推測は「〜と推察される」等、推測であることを明示すること
- 回答は必ず以下の4セクションに分けて、各セクションのヘッダーをそのまま使うこと：
  [事業概要]、[競合環境]、[強みとリスク]、[直近の動向]`;

/** Claude に送るユーザープロンプトを組み立てる */
function buildUserPrompt(req: AIResearchRequest): string {
  const lines = [
    `以下の企業について調査してください。`,
    ``,
    `企業名: ${req.companyName}`,
    `証券コード: ${req.stockCode}`,
  ];
  if (req.sector) lines.push(`業種: ${req.sector}`);
  if (req.businessSegment) lines.push(`事業セグメント: ${req.businessSegment}`);
  if (req.financialSummary) {
    lines.push(``, `直近の財務サマリー:`, req.financialSummary);
  }
  lines.push(
    ``,
    `上記4セクション（[事業概要]、[競合環境]、[強みとリスク]、[直近の動向]）に分けて回答してください。`,
    `各セクションは200〜400文字程度でお願いします。`
  );
  return lines.join('\n');
}

/** Claude のレスポンスを4セクションにパースする */
function parseResponse(
  text: string
): Omit<AIResearchResponse, 'model' | 'researchedAt'> {
  const sectionNames = [
    '事業概要',
    '競合環境',
    '強みとリスク',
    '直近の動向',
  ] as const;
  const sections: Record<(typeof sectionNames)[number], string> = {
    事業概要: '',
    競合環境: '',
    強みとリスク: '',
    直近の動向: '',
  };

  for (const name of sectionNames) {
    // [セクション名] または ## セクション名 のパターンに対応
    const pattern = new RegExp(
      `(?:\\[${name}\\]|##\\s*${name})\\s*\\n([\\s\\S]*?)(?=\\[(?:${sectionNames.join('|')})\\]|##\\s*(?:${sectionNames.join('|')})|$)`
    );
    const match = text.match(pattern);
    sections[name] = match?.[1]?.trim() ?? '';
  }

  // パースに失敗した場合は全文を事業概要に入れる
  if (Object.values(sections).every((s) => s === '')) {
    return {
      businessOverview: text.trim(),
      competitivePosition: '',
      strengthsAndRisks: '',
      recentNews: '',
    };
  }

  return {
    businessOverview: sections['事業概要'],
    competitivePosition: sections['競合環境'],
    strengthsAndRisks: sections['強みとリスク'],
    recentNews: sections['直近の動向'],
  };
}

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  private client: Anthropic | null = null;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-opus-4-8') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * Anthropic SDK の例外をプロバイダ非依存の AIProviderError に正規化する。
   * メッセージ文言の includes() 判定は SDK 更新で静かに壊れるため、
   * 可能な限り SDK の型付き例外クラスで instanceof 判定する
   */
  private normalizeError(error: unknown): AIProviderError {
    if (error instanceof Anthropic.AuthenticationError) {
      return new AIProviderError('auth', 'APIキーが無効です', { cause: error });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new AIProviderError('rate_limit', 'レート制限に達しました', {
        cause: error,
      });
    }
    // クレジット不足は専用の例外クラスがなく 400 で返るため、ここだけ文言で判定する
    if (
      error instanceof Anthropic.APIError &&
      String(error.message).includes('credit balance is too low')
    ) {
      return new AIProviderError(
        'insufficient_credit',
        'クレジット残高が不足しています',
        {
          cause: error,
        }
      );
    }
    return new AIProviderError('unknown', 'AI調査に失敗しました', {
      cause: error,
    });
  }

  async research(request: AIResearchRequest): Promise<AIResearchResponse> {
    let message: Anthropic.Message;
    try {
      message = await this.getClient().messages.create({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(request) }],
      });
    } catch (error) {
      throw this.normalizeError(error);
    }

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const parsed = parseResponse(text);

    return {
      ...parsed,
      model: this.model,
      researchedAt: new Date().toISOString(),
    };
  }
}
