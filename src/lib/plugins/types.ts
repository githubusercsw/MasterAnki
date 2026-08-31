/**
 * 插件体系统一类型定义（MasterAnki）
 *
 * 四类插件：
 * - LLMProvider：大模型后端
 * - InputSource：内容输入源
 * - CardTemplate：卡片模板
 * - AnkiBackend：Anki 后端适配
 *
 * 所有插件共享统一基类：id / displayName / capabilities / init
 * 能力声明（capabilities）用于把"环境/依赖假设"从业务逻辑中剥离。
 */

import type { CardType, ContentType } from '../anki/types';

export type PluginType = 'llm' | 'input' | 'card' | 'anki';

/** LLM 结构化输出能力（JSON 约束方式） */
export type StructuredOutputMode = 'schema' | 'json_object' | 'tool_use' | 'none';

/** 统一能力声明 */
export interface PluginCapabilities {
  /** LLM Provider：结构化输出方式 */
  structuredOutput?: StructuredOutputMode;
  /** LLM Provider：是否支持图片输入（多模态） */
  vision?: boolean;
  /** LLM Provider：是否本地模型（Ollama 等，离线可用） */
  offline?: boolean;
  /** InputSource：支持的内容类型 */
  contentTypes?: ContentType[];
  /** InputSource：是否需要网络 */
  needsNetwork?: boolean;
  /** CardTemplate：所需 Anki 模型 key */
  requiresModel?: string;
  /** CardTemplate：是否需要图片 */
  needsImage?: boolean;
  /** AnkiBackend：是否支持更新已有 note */
  canUpdateNote?: boolean;
  /** AnkiBackend：支持的卡片类型 */
  supportedModels?: CardType[];
}

/** 插件上下文（由注册表注入，提供设置/存储/事件总线） */
export interface PluginContext {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;
  getSecureSetting(key: string): Promise<string | null>;
  setSecureSetting(key: string, value: string): Promise<boolean>;
  emit(event: string, payload?: unknown): void;
}

/** 统一插件基类 */
export interface Plugin<P = unknown> {
  readonly id: string;
  readonly displayName: string;
  readonly type: PluginType;
  readonly capabilities: PluginCapabilities;
  /** 懒加载：注册后按需初始化（未激活的插件不 init、不拉 SDK） */
  init?(ctx: PluginContext): Promise<void>;
  /** 插件自定义数据 */
  data?: P;
}
