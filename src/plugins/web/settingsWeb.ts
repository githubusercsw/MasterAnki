/**
 * Settings Web 降级实现
 *
 * Web（浏览器）环境用 localStorage 模拟非敏感键值存储。
 * 与原生 SharedPreferences 行为一致；敏感配置仍走 secure storage 不在此插件。
 */

import type { SettingsPlugin } from '../Settings';

const PREFIX = 'ma:settings:';

export const webSettings: SettingsPlugin = {
  async getSetting({ key }) {
    return { value: window.localStorage.getItem(PREFIX + key) };
  },

  async setSetting({ key, value }) {
    window.localStorage.setItem(PREFIX + key, value);
  },

  async deleteSetting({ key }) {
    window.localStorage.removeItem(PREFIX + key);
  },
};
