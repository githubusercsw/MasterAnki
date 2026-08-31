/**
 * Ollama Provider（本地模型）
 *
 * 复用 OpenAI 兼容基类（Ollama 提供 /v1/chat/completions 兼容端点）。
 * 关键差异：requiresApiKey=false（无需 Key）、offline=true（本地离线）。
 * Endpoint 默认为 http://localhost:11434，可在设置页自定义。
 */

import { OpenAICompatibleProvider } from './openaiCompatible';

export const OLLAMA_PROVIDER_ID = 'ollama';
export const DEFAULT_OLLAMA_MODEL = 'llama3';
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

export function createOllamaProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    providerId: OLLAMA_PROVIDER_ID,
    displayName: 'Ollama (Local)',
    defaultModel: DEFAULT_OLLAMA_MODEL,
    baseUrl: DEFAULT_OLLAMA_ENDPOINT,
    requiresApiKey: false,
    defaultEndpoint: DEFAULT_OLLAMA_ENDPOINT,
  });
}
