/**
 * OpenAI Provider（GPT-4o 系列）
 * 复用 OpenAI 兼容基类。
 */

import { OpenAICompatibleProvider } from './openaiCompatible';

export const OPENAI_PROVIDER_ID = 'openai';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export function createOpenAIProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    providerId: OPENAI_PROVIDER_ID,
    displayName: 'OpenAI',
    defaultModel: DEFAULT_OPENAI_MODEL,
    baseUrl: 'https://api.openai.com/v1',
    vision: true,
  });
}
