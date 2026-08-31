/**
 * Kimi Provider（月之暗面 Moonshot）
 * 兼容 OpenAI 协议：https://api.moonshot.cn/v1
 */

import { OpenAICompatibleProvider } from './openaiCompatible';

export const KIMI_PROVIDER_ID = 'kimi';
export const DEFAULT_KIMI_MODEL = 'moonshot-v1-8k';

export function createKimiProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    providerId: KIMI_PROVIDER_ID,
    displayName: 'Kimi',
    defaultModel: DEFAULT_KIMI_MODEL,
    baseUrl: 'https://api.moonshot.cn/v1',
  });
}
