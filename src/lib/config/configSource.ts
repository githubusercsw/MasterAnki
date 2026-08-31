/**
 * 统一配置源（ConfigSource）
 *
 * 收敛环境分支：生产用 secure storage，开发回退到 import.meta.env，最后兜底默认值。
 * 业务层只调 getConfig / getSecret，不再感知 import.meta.env.DEV 等环境细节。
 */

import type { PluginContext } from '../plugins/types';

export interface ConfigOptions {
  /** 默认值（最低优先级） */
  default?: string;
  /** 是否为敏感配置（走 secure storage） */
  secret?: boolean;
}

/**
 * 统一配置源实现。
 *
 * 读取优先级（自上而下，命中即返回）：
 * 1. secure storage 持久值（生产/用户设置）
 * 2. import.meta.env 环境变量（仅开发可用）
 * 3. 默认值
 */
export class ConfigSource {
  constructor(private readonly ctx: PluginContext) {}

  /** 读取配置（先 secure，再 env，再默认值） */
  async get(key: string, opts: ConfigOptions = {}): Promise<string | null> {
    // 1. secure storage 持久值
    if (opts.secret) {
      const secured = await this.ctx.getSecureSetting(key);
      if (secured != null && secured !== '') return secured;
    } else {
      const stored = await this.ctx.getSetting(key);
      if (stored != null && stored !== '') return stored;
    }

    // 2. 环境变量（仅开发；secret 项也从 env 读取便于本地联调）
    if (import.meta.env.DEV) {
      const envKey = key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
      const envVal = import.meta.env[`VITE_${envKey}`] as string | undefined;
      if (envVal) return envVal;
    }

    // 3. 默认值
    return opts.default ?? null;
  }

  /** 读取 secret 配置（等价 get + secret: true） */
  getSecret(key: string, fallback?: string): Promise<string | null> {
    return this.get(key, { secret: true, default: fallback });
  }

  /** 写入非敏感配置 */
  async set(key: string, value: string): Promise<void> {
    await this.ctx.setSetting(key, value);
  }

  /** 写入敏感配置 */
  async setSecret(key: string, value: string): Promise<boolean> {
    return this.ctx.setSecureSetting(key, value);
  }

  /** 删除配置 */
  async delete(key: string): Promise<void> {
    await this.ctx.deleteSetting(key);
  }
}
