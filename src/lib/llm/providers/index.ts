/**
 * LLM Provider 统一注册入口
 *
 * 新增 Provider = 在此处加一行，核心管线零改动。
 */

import type { LLMProvider } from '../provider';
import { GeminiProvider, GEMINI_PROVIDER_ID, DEFAULT_GEMINI_MODEL } from './gemini';
import { createOpenAIProvider, OPENAI_PROVIDER_ID, DEFAULT_OPENAI_MODEL } from './openai';
import { ClaudeProvider, CLAUDE_PROVIDER_ID, DEFAULT_CLAUDE_MODEL } from './claude';
import {
  createOllamaProvider,
  OLLAMA_PROVIDER_ID,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_ENDPOINT,
} from './ollama';
import { createQwenProvider, QWEN_PROVIDER_ID, DEFAULT_QWEN_MODEL } from './qwen';
import { createDeepSeekProvider, DEEPSEEK_PROVIDER_ID, DEFAULT_DEEPSEEK_MODEL } from './deepseek';
import { createKimiProvider, KIMI_PROVIDER_ID, DEFAULT_KIMI_MODEL } from './kimi';

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
  OPENAI_PROVIDER_ID,
  DEFAULT_OPENAI_MODEL,
  CLAUDE_PROVIDER_ID,
  DEFAULT_CLAUDE_MODEL,
  OLLAMA_PROVIDER_ID,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_ENDPOINT,
  QWEN_PROVIDER_ID,
  DEFAULT_QWEN_MODEL,
  DEEPSEEK_PROVIDER_ID,
  DEFAULT_DEEPSEEK_MODEL,
  KIMI_PROVIDER_ID,
  DEFAULT_KIMI_MODEL,
};

/** Provider 元数据（设置页渲染用；不创建实例） */
export interface ProviderMeta {
  id: string;
  name: string;
  needsEndpoint: boolean;
  offline: boolean;
  /** 该 Provider 的默认模型（按 Provider 分发，不写死单一默认模型） */
  defaultModel: string;
}

export const PROVIDER_META: ProviderMeta[] = [
  {
    id: GEMINI_PROVIDER_ID,
    name: 'Gemini',
    needsEndpoint: false,
    offline: false,
    defaultModel: DEFAULT_GEMINI_MODEL,
  },
  {
    id: OPENAI_PROVIDER_ID,
    name: 'OpenAI',
    needsEndpoint: false,
    offline: false,
    defaultModel: DEFAULT_OPENAI_MODEL,
  },
  {
    id: CLAUDE_PROVIDER_ID,
    name: 'Claude',
    needsEndpoint: false,
    offline: false,
    defaultModel: DEFAULT_CLAUDE_MODEL,
  },
  {
    id: OLLAMA_PROVIDER_ID,
    name: 'Ollama (Local)',
    needsEndpoint: true,
    offline: true,
    defaultModel: DEFAULT_OLLAMA_MODEL,
  },
  {
    id: QWEN_PROVIDER_ID,
    name: '通义千问',
    needsEndpoint: false,
    offline: false,
    defaultModel: DEFAULT_QWEN_MODEL,
  },
  {
    id: DEEPSEEK_PROVIDER_ID,
    name: 'DeepSeek',
    needsEndpoint: false,
    offline: false,
    defaultModel: DEFAULT_DEEPSEEK_MODEL,
  },
  {
    id: KIMI_PROVIDER_ID,
    name: 'Kimi',
    needsEndpoint: false,
    offline: false,
    defaultModel: DEFAULT_KIMI_MODEL,
  },
];
