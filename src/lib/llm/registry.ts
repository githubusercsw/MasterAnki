/**
 * LLM Provider 注册表
 *
 * 类型化封装 PluginRegistry：llm 类型插件的注册与活跃项管理。
 */

import { PluginRegistry } from '../plugins/registry';
import type { PluginContext } from '../plugins/types';
import type { LLMProvider } from './provider';

export class LLMRegistry {
  private registry: PluginRegistry;

  constructor(ctx: PluginContext) {
    this.registry = new PluginRegistry(ctx);
  }

  register(provider: LLMProvider): void {
    this.registry.register(provider);
  }

  registerAll(providers: LLMProvider[]): void {
    for (const p of providers) this.registry.register(p);
  }

  get(id: string): LLMProvider | undefined {
    return this.registry.get<LLMProvider>(id);
  }

  list(): LLMProvider[] {
    return this.registry.list('llm') as LLMProvider[];
  }

  async setActive(id: string): Promise<void> {
    this.registry.setActive('llm', id);
  }

  getActiveId(): string | undefined {
    return this.registry.getActiveId('llm');
  }

  async getActive(): Promise<LLMProvider> {
    return this.registry.getActive<LLMProvider>('llm');
  }

  /** 懒加载初始化指定 Provider */
  async load(id: string): Promise<void> {
    await this.registry.load(id);
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  ids(): string[] {
    return this.registry.ids();
  }
}
