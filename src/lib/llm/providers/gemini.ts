/**
 * Gemini LLM Provider
 *
 * 适配 Google Gemini API，能力声明：原生 schema 结构化输出 + 多模态（vision）。
 * 配置通过统一配置源读取：secure storage / env / 默认值。
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import type {
  LLMProvider,
  LLMResponse,
  LLMGenerateOptions,
  TestConnectionResult,
} from '../provider';
import type { PluginContext } from '../../plugins/types';

export const GEMINI_PROVIDER_ID = 'gemini';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

const KEYS = {
  apiKey: 'masteranki:provider:gemini:apiKey',
  model: 'masteranki:provider:gemini:model',
};

/** 通用 JSON schema 转 Gemini Schema（仅在边界处做一次类型断言） */
function toGeminiSchema(schema: Record<string, unknown>): Schema {
  const s = schema as Record<string, unknown>;
  const type = (s.type as string) ?? 'object';
  const geminiType =
    type === 'array' ? SchemaType.ARRAY : type === 'string' ? SchemaType.STRING : SchemaType.OBJECT;

  const result: Record<string, unknown> = { type: geminiType };
  if (Array.isArray(s.required)) result.required = s.required as string[];
  if (s.properties && typeof s.properties === 'object') {
    result.properties = Object.fromEntries(
      Object.entries(s.properties as Record<string, unknown>).map(([k, v]) => [
        k,
        toGeminiSchema(v as Record<string, unknown>),
      ])
    );
  }
  if (s.items && typeof s.items === 'object') {
    result.items = toGeminiSchema(s.items as Record<string, unknown>);
  }
  return result as unknown as Schema;
}

export class GeminiProvider implements LLMProvider {
  readonly id = GEMINI_PROVIDER_ID;
  readonly displayName = 'Gemini';
  readonly type = 'llm' as const;
  readonly capabilities = {
    structuredOutput: 'schema' as const,
    vision: true,
    offline: false,
  };

  private ctx?: PluginContext;

  async init(ctx: PluginContext): Promise<void> {
    // 保留上下文引用，供配置热更新等扩展使用
    this.ctx = ctx;
  }

  private getSetting(key: string): Promise<string | null> {
    if (!this.ctx) return Promise.resolve(null);
    return this.ctx.getSecureSetting(key);
  }

  private async buildClient(): Promise<{
    model: import('@google/generative-ai').GenerativeModel;
  }> {
    const apiKey = (await this.getSetting(KEYS.apiKey)) ?? null;
    if (!apiKey) {
      throw new Error('Gemini API Key not configured. Please set your API key in Settings.');
    }
    const modelName = (await this.getSetting(KEYS.model)) || DEFAULT_GEMINI_MODEL;
    const genAI = new GoogleGenerativeAI(apiKey);
    return { model: genAI.getGenerativeModel({ model: modelName }) };
  }

  async generateContent(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResponse> {
    const { model } = await this.buildClient();

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    };
    if (options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }

    let result;
    try {
      if (options.schema) {
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            ...generationConfig,
            responseMimeType: 'application/json',
            responseSchema: toGeminiSchema(options.schema),
          } as import('@google/generative-ai').GenerationConfig,
        });
      } else {
        result = await model.generateContent(prompt);
      }
    } catch (e) {
      console.error('[Gemini] generateContent failed:', e);
      return { text: '', finishReason: 'error' };
    }

    const response = result.response;
    const finishReason = (response.candidates?.[0]?.finishReason as string) ?? 'STOP';
    let text = '';
    try {
      text = response.text();
    } catch {
      text = '';
    }

    return {
      text,
      finishReason:
        finishReason === 'MAX_TOKENS' ? 'max_tokens' : finishReason === 'STOP' ? 'stop' : 'stop',
    };
  }

  async validateConfig(): Promise<boolean> {
    const key = await this.getSetting(KEYS.apiKey);
    return !!key && key.length > 0;
  }

  async testConnection(): Promise<TestConnectionResult> {
    const apiKey = (await this.getSetting(KEYS.apiKey)) ?? null;
    if (!apiKey) {
      return { ok: false, issue: 'missing_key', message: 'Gemini API Key 未配置' };
    }
    try {
      const { model } = await this.buildClient();
      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: {
          maxOutputTokens: 1,
        } as import('@google/generative-ai').GenerationConfig,
      });
      return { ok: true, issue: 'ok', message: '连接成功' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (/api key|permission|401|403|unauthenticated|denied/i.test(msg)) {
        return { ok: false, issue: 'invalid_key', message: `API Key 无效：${msg}` };
      }
      if (/not found|404|model/i.test(msg)) {
        return { ok: false, issue: 'model_error', message: `模型/请求错误：${msg}` };
      }
      return { ok: false, issue: 'network', message: `网络/端点不可达：${msg}` };
    }
  }

  async getConfiguredModel(): Promise<string> {
    return (await this.getSetting(KEYS.model)) || DEFAULT_GEMINI_MODEL;
  }
}
