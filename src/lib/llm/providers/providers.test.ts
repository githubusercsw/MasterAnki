import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from './openaiCompatible';
import { ClaudeProvider } from './claude';
import { createOpenAIProvider, OPENAI_PROVIDER_ID } from './openai';
import { createQwenProvider } from './qwen';
import { createDeepSeekProvider } from './deepseek';
import { createKimiProvider } from './kimi';
import { createOllamaProvider } from './ollama';
import { PROVIDER_META, buildAllProviders } from './index';
import type { PluginContext } from '../../plugins/types';

function makeCtx(secure: Record<string, string> = {}): PluginContext {
  return {
    async getSetting() {
      return null;
    },
    async setSetting() {},
    async deleteSetting() {},
    async getSecureSetting(key) {
      return secure[key] ?? null;
    },
    async setSecureSetting(key, value) {
      secure[key] = value;
      return true;
    },
    emit() {},
  };
}

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"deck":"D","cards":[]}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends chat/completions with Bearer auth and parses response', async () => {
    const p = createOpenAIProvider();
    await p.init(makeCtx({ 'masteranki:provider:openai:apiKey': 'sk-test' }));
    const res = await p.generateContent('make flashcards');
    expect(res.text).toBe('{"deck":"D","cards":[]}');
    expect(res.finishReason).toBe('stop');
    expect(res.usage?.inputTokens).toBe(10);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/chat/completions');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });

  it('throws when API key missing (requiresApiKey provider)', async () => {
    const p = createOpenAIProvider();
    await p.init(makeCtx({}));
    await expect(p.generateContent('x')).rejects.toThrow(/API Key not configured/);
  });

  it('returns error finishReason on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'boom' } }) })
    );
    const p = createOpenAIProvider();
    await p.init(makeCtx({ 'masteranki:provider:openai:apiKey': 'sk-test' }));
    const res = await p.generateContent('x');
    expect(res.finishReason).toBe('error');
    expect(res.text).toBe('');
  });

  it('reports schema-aware response_format when schema provided', async () => {
    const p = createOpenAIProvider();
    await p.init(makeCtx({ 'masteranki:provider:openai:apiKey': 'sk-test' }));
    await p.generateContent('x', { schema: { type: 'object' } });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});

describe('国产 Provider 复用 OpenAI 兼容基类', () => {
  it('qwen/deepseek/kimi/ollama 均继承基类且能力声明正确', () => {
    const qwen = createQwenProvider();
    const ds = createDeepSeekProvider();
    const kimi = createKimiProvider();
    const ollama = createOllamaProvider();

    expect(qwen).toBeInstanceOf(OpenAICompatibleProvider);
    expect(ds).toBeInstanceOf(OpenAICompatibleProvider);
    expect(kimi).toBeInstanceOf(OpenAICompatibleProvider);
    expect(ollama).toBeInstanceOf(OpenAICompatibleProvider);

    // Ollama 无需 Key 且离线
    expect(ollama.capabilities.offline).toBe(true);
    // 其余需 Key
    expect(qwen.capabilities.offline).toBe(false);
  });

  it('Ollama validateConfig 无 Key 也通过', async () => {
    const ollama = createOllamaProvider();
    await ollama.init(makeCtx({}));
    await expect(ollama.validateConfig()).resolves.toBe(true);
  });
});

describe('ClaudeProvider (tool_use)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'tool_use', name: 'emit_json', input: { deck: 'D', cards: [] } }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 20, output_tokens: 8 },
        }),
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('发送 Anthropic Messages API 并提取 tool_use input', async () => {
    const p = new ClaudeProvider();
    await p.init(makeCtx({ 'masteranki:provider:claude:apiKey': 'sk-ant-test' }));
    const res = await p.generateContent('make flashcards', { schema: { type: 'object' } });
    expect(res.text).toBe('{"deck":"D","cards":[]}');
    expect(res.finishReason).toBe('stop');
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(init.body as string);
    expect(body.tools).toBeDefined();
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'emit_json' });
  });

  it('API key 缺失时抛错', async () => {
    const p = new ClaudeProvider();
    await p.init(makeCtx({}));
    await expect(p.generateContent('x')).rejects.toThrow(/API Key not configured/);
  });
});

describe('统一注册入口', () => {
  it('PROVIDER_META 覆盖全部 7 个 Provider', () => {
    const ids = PROVIDER_META.map((m) => m.id);
    expect(ids).toEqual([
      'gemini',
      'openai',
      'claude',
      'ollama',
      'qwen',
      'deepseek',
      'kimi',
    ]);
  });

  it('buildAllProviders 返回 7 个实例且 id 唯一', () => {
    const providers = buildAllProviders();
    expect(providers).toHaveLength(7);
    const ids = new Set(providers.map((p) => p.id));
    expect(ids.size).toBe(7);
  });

  it('openai provider id 常量一致', () => {
    expect(OPENAI_PROVIDER_ID).toBe('openai');
  });
});
