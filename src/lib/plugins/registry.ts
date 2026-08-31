/**
 * 插件注册表（PluginRegistry）
 *
 * 支持按类型注册/查询/激活，懒加载初始化。
 * 活跃插件的选择通过设置项读取，核心流程零改动。
 */

import type { Plugin, PluginType, PluginContext } from './types';

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private contexts = new Map<string, PluginContext>();
  private initialized = new Set<string>();
  private activeIds = new Map<PluginType, string>();

  constructor(private readonly defaultContext: PluginContext) {}

  /** 注册插件（不初始化，懒加载） */
  register<P>(plugin: Plugin<P>): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  /** 批量注册 */
  registerAll(plugins: Plugin[]): void {
    for (const p of plugins) this.register(p);
  }

  /** 按 id 获取插件 */
  get<P extends Plugin = Plugin>(id: string): P | undefined {
    return this.plugins.get(id) as P | undefined;
  }

  /** 按类型列出插件 */
  list(type: PluginType): Plugin[] {
    return [...this.plugins.values()].filter((p) => p.type === type);
  }

  /** 判断插件是否存在 */
  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * 懒加载初始化插件。
   * 初始化失败时记录但抛出异常，由调用方决定是否降级。
   */
  async load(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin not found: ${id}`);
    if (this.initialized.has(id)) return;

    const ctx = this.contexts.get(id) ?? this.defaultContext;
    if (plugin.init) {
      await plugin.init(ctx);
    }
    this.initialized.add(id);
  }

  /** 注入插件专属上下文（可选） */
  setContext(id: string, ctx: PluginContext): void {
    this.contexts.set(id, ctx);
  }

  /** 记录某类型的活跃插件 id */
  setActive(type: PluginType, id: string): void {
    if (!this.has(id)) throw new Error(`Cannot set active: unknown plugin ${id}`);
    this.activeIds.set(type, id);
  }

  /** 读取某类型的活跃插件 id */
  getActiveId(type: PluginType): string | undefined {
    return this.activeIds.get(type);
  }

  /**
   * 获取某类型的活跃插件并懒加载初始化。
   * @throws 未设置活跃插件时抛出
   */
  async getActive<T extends Plugin>(type: PluginType): Promise<T> {
    const id = this.activeIds.get(type);
    if (!id) {
      throw new Error(`No active ${type} plugin configured`);
    }
    await this.load(id);
    return this.plugins.get(id) as T;
  }

  /** 所有已注册插件 id */
  ids(): string[] {
    return [...this.plugins.keys()];
  }

  /** 已初始化集合（测试与诊断用） */
  getInitialized(): string[] {
    return [...this.initialized];
  }
}
