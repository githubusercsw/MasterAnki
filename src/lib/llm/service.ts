/**
 * LLMService 单例
 *
 * 统一管理：
 * - Provider 注册（buildAllProviders 全部注册，懒加载 init）
 * - 活跃 Provider 动态选择（读取/写入 secure storage 的 active id）
 * - 三步管线构建（活跃 Provider + 用户自定义 prompt）
 *
 * 应用启动时调用 init()，之后通过 getPipeline() 获取管线。
 */

import { LLMRegistry } from './registry';
import { buildAllProviders, PROVIDER_META, GEMINI_PROVIDER_ID } from './providers';
import { LLMPipeline } from './pipeline';
import type { LLMProvider } from './provider';
import type { PluginContext } from '../plugins/types';
import { ConfigSource } from '../config/configSource';
import { PromptService } from '../settings/promptConfig';
import {
  getActiveProviderId,
  setActiveProviderId,
} from '../settings/secureStorage';

export const ACTIVE_PROVIDER_STORAGE_KEY = 'masteranki:provider:active';

export class LLMService {
  private static _instance: LLMService | null = null;

  private registry: LLMRegistry;
  private ctx: PluginContext;
  private initialized = false;

  private constructor(ctx: PluginContext) {
    this.ctx = ctx;
    this.registry = new LLMRegistry(ctx);
  }

  /** 获取单例（无单例时以给定上下文创建） */
  static getInstance(ctx?: PluginContext): LLMService {
    if (!LLMService._instance) {
      if (!ctx) throw new Error('LLMService.init(ctx) must be called before getInstance()');
      LLMService._instance = new LLMService(ctx);
    }
    return LLMService._instance;
  }

  /** 应用启动时调用：注册全部 Provider，加载活跃项 */
  async init(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    this.registry = new LLMRegistry(ctx);
    this.registry.registerAll(buildAllProviders());
    this.initialized = true;

    // 恢复活跃 Provider（默认 Gemini）
    const activeId = (await getActiveProviderId()) ?? GEMINI_PROVIDER_ID;
    if (this.registry.has(activeId)) {
      await this.setActive(activeId, false);
    }
  }

  /** 注册表（测试/诊断用） */
  getRegistry(): LLMRegistry {
    return this.registry;
  }

  /** 列出全部 Provider */
  list(): LLMProvider[] {
    return this.registry.list();
  }

  /** Provider 元数据（设置页渲染用） */
  getMeta() {
    return PROVIDER_META;
  }

  /** 当前活跃 Provider id */
  getActiveId(): string | undefined {
    return this.registry.getActiveId();
  }

  /** 切换活跃 Provider（可选持久化） */
  async setActive(providerId: string, persist = true): Promise<void> {
    if (!this.registry.has(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    await this.registry.load(providerId); // 懒加载 init
    await this.registry.setActive(providerId);
    if (persist) {
      await setActiveProviderId(providerId);
    }
  }

  /** 获取活跃 Provider（已 init） */
  async getActiveProvider(): Promise<LLMProvider> {
    this.ensureInit();
    return this.registry.getActive();
  }

  /** 构建三步管线（活跃 Provider + 用户 prompt） */
  async getPipeline(): Promise<LLMPipeline> {
    this.ensureInit();
    const provider = await this.getActiveProvider();
    const config = new ConfigSource(this.ctx);
    const prompts = new PromptService(config);
    return new LLMPipeline(provider, {
      factExtractionPrompt: await prompts.getFactExtractionPrompt(),
      factScoringPrompt: await prompts.getFactScoringPrompt(),
      flashcardCreationPrompt: await prompts.getFlashcardCreationPrompt(),
    });
  }

  private ensureInit(): void {
    if (!this.initialized) {
      throw new Error('LLMService.init(ctx) has not been called yet.');
    }
  }

  /** 测试专用：重置单例 */
  static resetForTest(): void {
    LLMService._instance = null;
  }
}
