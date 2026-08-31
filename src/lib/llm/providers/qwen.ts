/**
 * 通义千问 Provider（阿里云 DashScope）
 * 兼容 OpenAI 协议端点：https://dashscope.aliyuncs.com/compatible-mode/v1
 */

import { OpenAICompatibleProvider } from './openaiCompatible';

export const QWEN_PROVIDER_ID = 'qwen';
export const DEFAULT_QWEN_MODEL = 'qwen-plus';

export function createQwenProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    providerId: QWEN_PROVIDER_ID,
    displayName: '通义千问',
    defaultModel: DEFAULT_QWEN_MODEL,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });
}
