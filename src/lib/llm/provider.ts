/**
 * LLM Provider 抽象接口
 *
 * 能力声明把"环境/依赖假设"从业务逻辑剥离：
 * 管线按 capabilities 分支（schema / json_object / tool_use / none），
 * 不按 providerId 分支。
 */

import type { Plugin } from '../plugins/types';
import type { StructuredOutputMode } from '../plugins/types';

export interface LLMGenerateOptions {
  /** 期望的结构化输出 schema（JSON Schema 风格） */
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  finishReason: 'stop' | 'max_tokens' | 'error';
  usage?: LLMUsage;
}

/** 测试连接失败原因（区分四类 BYOK 常见失败） */
export type ConnectionIssue = 'missing_key' | 'invalid_key' | 'network' | 'model_error' | 'ok';

export interface TestConnectionResult {
  ok: boolean;
  issue: ConnectionIssue;
  message: string;
}

export interface LLMProvider extends Plugin {
  readonly type: 'llm';
  readonly capabilities: {
    structuredOutput: StructuredOutputMode;
    vision: boolean;
    offline: boolean;
  };

  /** 生成内容 */
  generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;

  /** 校验当前配置是否可用（Key/Endpoint） */
  validateConfig(): Promise<boolean>;

  /** 测试连接：真实发起一次最小请求，区分四类失败原因（BYOK 刚需） */
  testConnection(): Promise<TestConnectionResult>;

  /** 读取当前已配置的模型名 */
  getConfiguredModel(): Promise<string>;
}
