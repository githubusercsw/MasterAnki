/**
 * 安全存储（多 Provider Key 管理）
 *
 * 密钥命名规则：masteranki:provider:{providerId}:apiKey
 * 所有敏感配置通过 Capacitor secure storage（Android KeyStore）读写。
 * Web 环境自动降级到 localStorage（仅开发/测试）。
 */

import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { isPlatform } from '@ionic/react';

const PREFIX = 'masteranki:provider';

/** 判断是否运行在原生平台 */
export function isNativePlatform(): boolean {
  try {
    return isPlatform('capacitor');
  } catch {
    return false;
  }
}

/** 计算 provider 的 key 存储名 */
export function providerKeyName(providerId: string): string {
  return `${PREFIX}:${providerId}:apiKey`;
}

export function providerModelName(providerId: string): string {
  return `${PREFIX}:${providerId}:model`;
}

export function providerEndpointName(providerId: string): string {
  return `${PREFIX}:${providerId}:endpoint`;
}

export function activeProviderKey(): string {
  return `${PREFIX}:active`;
}

/** 读取敏感值（原生走 KeyStore，Web 降级 localStorage） */
export async function getSecure(key: string): Promise<string | null> {
  if (isNativePlatform()) {
    try {
      const result = await SecureStoragePlugin.get({ key });
      return result.value;
    } catch {
      return null;
    }
  }
  return window.localStorage.getItem(`sec:${key}`);
}

/** 写入敏感值 */
export async function setSecure(key: string, value: string): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      await SecureStoragePlugin.set({ key, value });
      return true;
    } catch (e) {
      console.error('Failed to save secure value:', e);
      return false;
    }
  }
  window.localStorage.setItem(`sec:${key}`, value);
  return true;
}

/** 删除敏感值 */
export async function removeSecure(key: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      await SecureStoragePlugin.remove({ key });
    } catch {
      // ignore
    }
    return;
  }
  window.localStorage.removeItem(`sec:${key}`);
}

/** 读取指定 Provider 的 API Key */
export function getProviderApiKey(providerId: string): Promise<string | null> {
  return getSecure(providerKeyName(providerId));
}

/** 保存指定 Provider 的 API Key */
export function setProviderApiKey(providerId: string, value: string): Promise<boolean> {
  return setSecure(providerKeyName(providerId), value);
}

/** 读取指定 Provider 的模型 */
export async function getProviderModel(providerId: string): Promise<string | null> {
  const v = await getSecure(providerModelName(providerId));
  return v;
}

/** 保存指定 Provider 的模型 */
export function setProviderModel(providerId: string, value: string): Promise<boolean> {
  return setSecure(providerModelName(providerId), value);
}

/** 读取活跃 Provider id */
export function getActiveProviderId(): Promise<string | null> {
  return getSecure(activeProviderKey());
}

/** 设置活跃 Provider id */
export function setActiveProviderId(id: string): Promise<boolean> {
  return setSecure(activeProviderKey(), id);
}

/** 清除某 Provider 全部配置 */
export async function clearProviderSettings(providerId: string): Promise<void> {
  await removeSecure(providerKeyName(providerId));
  await removeSecure(providerModelName(providerId));
  await removeSecure(providerEndpointName(providerId));
}
