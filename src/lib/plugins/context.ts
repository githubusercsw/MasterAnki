/**
 * 默认插件上下文实现
 *
 * 将插件的设置读写桥接到实际存储后端（Capacitor 插件）。
 * 在 Web 环境下自动回退到 localStorage，便于开发与测试。
 */

import type { PluginContext } from './types';

/** Web 环境降级存储实现（未运行在 Capacitor 原生层时） */
export function createWebFallbackContext(): PluginContext {
  const storage = window.localStorage;
  const secure = storage; // Web 端无 KeyStore，用 localStorage 降级（仅开发/测试）

  return {
    async getSetting(key) {
      return storage.getItem(key);
    },
    async setSetting(key, value) {
      storage.setItem(key, value);
    },
    async deleteSetting(key) {
      storage.removeItem(key);
    },
    async getSecureSetting(key) {
      return secure.getItem(`sec:${key}`);
    },
    async setSecureSetting(key, value) {
      secure.setItem(`sec:${key}`, value);
      return true;
    },
    emit(event, payload) {
      window.dispatchEvent(new CustomEvent(`ma:${event}`, { detail: payload }));
    },
  };
}

/** 全局默认上下文（单例）：Web 回退实现，供 ThemeProvider / i18n / LLMService 共享存储 */
let _defaultCtx: PluginContext | null = null;
export function getDefaultContext(): PluginContext {
  if (!_defaultCtx) {
    _defaultCtx = createWebFallbackContext();
  }
  return _defaultCtx;
}

/** 空上下文（测试占位，所有操作 no-op） */
export function createNoopContext(): PluginContext {
  return {
    async getSetting() {
      return null;
    },
    async setSetting() {},
    async deleteSetting() {},
    async getSecureSetting() {
      return null;
    },
    async setSecureSetting() {
      return true;
    },
    emit() {},
  };
}
