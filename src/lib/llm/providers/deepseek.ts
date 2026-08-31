/**
 * DeepSeek Provider
 * 兼容 OpenAI 协议：https://api.deepseek.com/v1
 */

import { OpenAICompatibleProvider } from './openaiCompatible';

export const DEEPSEEK_PROVIDER_ID = 'deepseek';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

export function createDeepSeekProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    providerId: DEEPSEEK_PROVIDER_ID,
    displayName: 'DeepSeek',
    defaultModel: DEFAULT_DEEPSEEK_MODEL,
    baseUrl: 'https://api.deepseek.com/v1',
  });
}
