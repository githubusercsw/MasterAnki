/**
 * Settings Capacitor 插件接口
 *
 * 非敏感设置的键值存储（自定义提示词等）。
 * 敏感配置（API Key）走 secure storage，不走此插件。
 */

import { registerPlugin } from '@capacitor/core';

export interface SettingsPlugin {
  getSetting(options: { key: string }): Promise<{ value: string | null }>;
  setSetting(options: { key: string; value: string }): Promise<void>;
  deleteSetting(options: { key: string }): Promise<void>;
}

const Settings = registerPlugin<SettingsPlugin>('Settings');

export default Settings;
