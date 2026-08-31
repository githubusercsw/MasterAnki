/**
 * LLM Provider 统一注册入口
 *
 * 新增 Provider = 在此处加一行，核心管线零改动。
 */

import type { LLMProvider } from '../provider';
import { GeminiProvider } from './gemini';
import { createOpenAIProvider } from './openai';
import { ClaudeProvider } from './claude';
import { createOllamaProvider } from './ollama';
import { createQwenProvider } from './qwen';
import { createDeepSeekProvider } from './deepseek';
import { createKimiProvider } from './kimi';

/** 全部已注册的 LLM Provider（懒加载，未激活不 init） */
export function buildAllProviders(): LLMProvider[] {
  return [
    new GeminiProvider(),
    createOpenAIProvider(),
    new ClaudeProvider(),
    createOllamaProvider(),
    createQwenProvider(),
    createDeepSeekProvider(),
    createKimiProvider(),
  ];
}

export {
  GEMINI_PROVIDER_ID,
  DEFAULT_GEMINI_MODEL,
} from './gemini';
export { OPENAI_PROVIDER_ID, DEFAULT_OPENAI_MODEL } from './openai';
export { CLAUDE_PROVIDER_ID, DEFAULT_CLAUDE_MODEL } from './claude';
export { OLLAMA_PROVIDER_ID, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_ENDPOINT } from './ollama';
export { QWEN_PROVIDER_ID, DEFAULT_QWEN_MODEL } from './qwen';
export { DEEPSEEK_PROVIDER_ID, DEFAULT_DEEPSEEK_MODEL } from './deepseek';
export { KIMI_PROVIDER_ID, DEFAULT_KIMI_MODEL } from './kimi';

/** Provider 元数据（设置页渲染用；不创建实例） */
export interface ProviderMeta {
  id: string;
  name: string;
  needsEndpoint: boolean;
  offline: boolean;
}

export const PROVIDER_META: ProviderMeta[] = [
  { id: 'gemini', name: 'Gemini', needsEndpoint: false, offline: false },
  { id: 'openai', name: 'OpenAI', needsEndpoint: false, offline: false },
  { id: 'claude', name: 'Claude', needsEndpoint: false, offline: false },
  { id: 'ollama', name: 'Ollama (Local)', needsEndpoint: true, offline: true },
  { id: 'qwen', name: '通义千问', needsEndpoint: false, offline: false },
  { id: 'deepseek', name: 'DeepSeek', needsEndpoint: false, offline: false },
  { id: 'kimi', name: 'Kimi', needsEndpoint: false, offline: false },
];
