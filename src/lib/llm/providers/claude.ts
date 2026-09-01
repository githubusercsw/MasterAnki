/**
 * Claude Provider（Anthropic）
 *
 * 结构化输出策略：tool_use —— 定义唯一 tool，强制模型调用它返回 JSON。
 * 使用原生 fetch 调用 Anthropic Messages API。
 */

import type {
  LLMProvider,
  LLMResponse,
  LLMGenerateOptions,
  TestConnectionResult,
} from '../provider';
import type { PluginContext } from '../../plugins/types';

export const CLAUDE_PROVIDER_ID = 'claude';
export const DEFAULT_CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const ANTHROPIC_VERSION = '2023-06-01';
const TOOL_NAME = 'emit_json';

const KEYS = {
  apiKey: `masteranki:provider:${CLAUDE_PROVIDER_ID}:apiKey`,
  model: `masteranki:provider:${CLAUDE_PROVIDER_ID}:model`,
};

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponse {
  content?: ContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

export class ClaudeProvider implements LLMProvider {
  readonly id = CLAUDE_PROVIDER_ID;
  readonly displayName = 'Claude';
  readonly type = 'llm' as const;
  readonly capabilities = {
    structuredOutput: 'tool_use' as const,
    vision: true,
    offline: false,
  };

  private ctx?: PluginContext;

  async init(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
  }

  private getSetting(key: string): Promise<string | null> {
    return this.ctx ? this.ctx.getSecureSetting(key) : Promise.resolve(null);
  }

  private async resolveConfig() {
    const apiKey = (await this.getSetting(KEYS.apiKey)) ?? '';
    if (!apiKey) {
      throw new Error('Claude API Key not configured. Please set your API key in Settings.');
    }
    const model = (await this.getSetting(KEYS.model)) || DEFAULT_CLAUDE_MODEL;
    return { apiKey, model };
  }

  async generateContent(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResponse> {
    const { apiKey, model } = await this.resolveConfig();

    const messages: AnthropicMessage[] = [{ role: 'user', content: prompt }];
    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxOutputTokens ?? 8192,
      messages,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;

    // tool_use 结构化输出
    if (options.schema) {
      body.tools = [
        {
          name: TOOL_NAME,
          description: 'Emit the structured JSON output for the task.',
          input_schema: options.schema,
        },
      ];
      body.tool_choice = { type: 'tool', name: TOOL_NAME };
    }

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
      const data = (await resp.json()) as AnthropicResponse;
      if (!resp.ok || data.error) {
        return { text: '', finishReason: 'error' };
      }

      // 优先取 tool_use 的 input（结构化 JSON），否则取文本
      let text = '';
      const toolBlock = data.content?.find((b) => b.type === 'tool_use' && b.name === TOOL_NAME);
      if (toolBlock?.input !== undefined) {
        text = JSON.stringify(toolBlock.input);
      } else {
        text =
          data.content
            ?.filter((b): b is ContentBlock & { text: string } => b.type === 'text' && !!b.text)
            .map((b) => b.text)
            .join('') ?? '';
      }

      const stop = data.stop_reason ?? 'end_turn';
      return {
        text,
        finishReason:
          stop === 'max_tokens' ? 'max_tokens' : stop === 'stop_sequence' ? 'stop' : 'stop',
        usage: data.usage
          ? {
              inputTokens: data.usage.input_tokens ?? 0,
              outputTokens: data.usage.output_tokens ?? 0,
            }
          : undefined,
      };
    } catch (e) {
      console.error('[Claude] generateContent failed:', e);
      return { text: '', finishReason: 'error' };
    }
  }

  async validateConfig(): Promise<boolean> {
    const key = await this.getSetting(KEYS.apiKey);
    return !!key && key.length > 0;
  }

  async testConnection(): Promise<TestConnectionResult> {
    const apiKey = (await this.getSetting(KEYS.apiKey)) ?? '';
    if (!apiKey) {
      return { ok: false, issue: 'missing_key', message: 'Claude API Key 未配置' };
    }
    const { model } = await this.resolveConfig();
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (resp.ok) return { ok: true, issue: 'ok', message: '连接成功' };
      const data = (await resp.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const detail = data?.error?.message ?? `HTTP ${resp.status}`;
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, issue: 'invalid_key', message: `API Key 无效：${detail}` };
      }
      if (resp.status === 404 || resp.status === 400) {
        return { ok: false, issue: 'model_error', message: `模型/请求错误：${detail}` };
      }
      return { ok: false, issue: 'network', message: `服务不可达（HTTP ${resp.status}）` };
    } catch (e) {
      return {
        ok: false,
        issue: 'network',
        message: `网络/端点不可达：${e instanceof Error ? e.message : 'unknown'}`,
      };
    }
  }

  async getConfiguredModel(): Promise<string> {
    return (await this.getSetting(KEYS.model)) || DEFAULT_CLAUDE_MODEL;
  }
}
