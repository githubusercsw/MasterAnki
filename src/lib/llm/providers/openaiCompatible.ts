/**
 * OpenAI 兼容 Provider 基类
 *
 * 覆盖 OpenAI、通义千问（DashScope）、DeepSeek、Kimi 四家 ——
 * 它们都遵循 OpenAI 的 /v1/chat/completions 协议。
 * 国产模型仅需指定 baseUrl 与默认模型即可复用本实现。
 *
 * JSON 约束：response_format: { type: 'json_object' }（能力声明 json_object）。
 * 统一使用 fetch，不引入额外 SDK，便于测试与依赖瘦身。
 */

import type {
  LLMProvider,
  LLMResponse,
  LLMGenerateOptions,
  TestConnectionResult,
} from '../provider';
import type { PluginContext } from '../../plugins/types';

export interface OpenAICompatibleOptions {
  providerId: string;
  displayName: string;
  defaultModel: string;
  /** API 基础地址，如 https://api.openai.com/v1 */
  baseUrl: string;
  /** 是否必须 API Key（Ollama 等本地模型可为 false） */
  requiresApiKey?: boolean;
  /** 默认 Endpoint（设置页显示用，Ollama 本地地址） */
  defaultEndpoint?: string;
  /** 是否支持图片输入（多模态） */
  vision?: boolean;
  /** 自定义 schema 转 prompt 的 JSON 约束说明 */
  jsonInstruction?: string;
}

const KEYS = {
  apiKey: (id: string) => `masteranki:provider:${id}:apiKey`,
  model: (id: string) => `masteranki:provider:${id}:model`,
  endpoint: (id: string) => `masteranki:provider:${id}:endpoint`,
};

/** OpenAI 兼容请求体结构 */
interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;
  readonly displayName: string;
  readonly type = 'llm' as const;
  readonly capabilities: {
    structuredOutput: 'json_object';
    vision: boolean;
    offline: boolean;
  };

  private readonly opts: OpenAICompatibleOptions;
  private ctx?: PluginContext;

  constructor(opts: OpenAICompatibleOptions) {
    this.opts = opts;
    this.id = opts.providerId;
    this.displayName = opts.displayName;
    this.capabilities = {
      structuredOutput: 'json_object',
      vision: opts.vision ?? false,
      offline: opts.requiresApiKey === false,
    };
  }

  async init(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
  }

  private getSetting(key: string): Promise<string | null> {
    return this.ctx ? this.ctx.getSecureSetting(key) : Promise.resolve(null);
  }

  private async resolveConfig() {
    const apiKey = (await this.getSetting(KEYS.apiKey(this.id))) ?? '';
    const model = (await this.getSetting(KEYS.model(this.id))) || this.opts.defaultModel;
    const endpoint =
      (await this.getSetting(KEYS.endpoint(this.id))) ||
      this.opts.defaultEndpoint ||
      this.opts.baseUrl;
    if (this.opts.requiresApiKey !== false && !apiKey) {
      throw new Error(
        `${this.displayName} API Key not configured. Please set your API key in Settings.`
      );
    }
    return { apiKey, model, endpoint };
  }

  async generateContent(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResponse> {
    const { apiKey, model, endpoint } = await this.resolveConfig();

    const body: ChatCompletionRequest = {
      model,
      messages: [{ role: 'user', content: prompt }],
    };
    if (options.maxOutputTokens) body.max_tokens = options.maxOutputTokens;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    // json_object 模式：OpenAI 系要求 prompt 中出现 "json" 关键字
    if (options.schema) {
      body.response_format = { type: 'json_object' };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    try {
      const resp = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = (await resp.json()) as ChatCompletionResponse;
      if (!resp.ok || data.error) {
        return { text: '', finishReason: 'error' };
      }
      const choice = data.choices?.[0];
      const finishReason = choice?.finish_reason ?? 'stop';
      return {
        text: choice?.message?.content ?? '',
        finishReason:
          finishReason === 'length' ? 'max_tokens' : finishReason === 'stop' ? 'stop' : 'stop',
        usage: data.usage
          ? {
              inputTokens: data.usage.prompt_tokens ?? 0,
              outputTokens: data.usage.completion_tokens ?? 0,
            }
          : undefined,
      };
    } catch (e) {
      console.error(`[${this.displayName}] generateContent failed:`, e);
      return { text: '', finishReason: 'error' };
    }
  }

  async validateConfig(): Promise<boolean> {
    const key = await this.getSetting(KEYS.apiKey(this.id));
    if (this.opts.requiresApiKey === false) return true; // 本地模型无需 Key
    return !!key && key.length > 0;
  }

  async testConnection(): Promise<TestConnectionResult> {
    const apiKey = (await this.getSetting(KEYS.apiKey(this.id))) ?? '';
    if (this.opts.requiresApiKey !== false && !apiKey) {
      return {
        ok: false,
        issue: 'missing_key',
        message: `${this.displayName} API Key 未配置`,
      };
    }
    const { model, endpoint } = await this.resolveConfig();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    try {
      const resp = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
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
    return (await this.getSetting(KEYS.model(this.id))) || this.opts.defaultModel;
  }
}
