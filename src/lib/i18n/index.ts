/**
 * i18n 初始化（i18next + react-i18next）
 *
 * - 三语言：en / zh / ja
 * - 语言偏好持久化到 ConfigSource（key: masteranki:language），启动恢复
 * - 通过 useLanguage hook 读写语言偏好，供设置页调用
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { PluginContext } from '../plugins/types';
import en from './locales/en';
import zh from './locales/zh';
import ja from './locales/ja';

export const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_KEY = 'masteranki:language';

/** 是否合法的语言代码 */
export function isLanguage(v: unknown): v is Language {
  return typeof v === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    ja: { translation: ja },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React 已做 XSS 转义
  },
  returnNull: false,
});

/** 启动时恢复持久化语言偏好 */
export async function initLanguage(ctx: PluginContext): Promise<void> {
  try {
    const saved = await ctx.getSetting(LANGUAGE_KEY);
    if (isLanguage(saved)) {
      await i18n.changeLanguage(saved);
    }
  } catch {
    // 恢复失败保持默认语言
  }
}

/** 切换语言并持久化 */
export async function setLanguage(ctx: PluginContext, lang: Language): Promise<void> {
  await i18n.changeLanguage(lang);
  await ctx.setSetting(LANGUAGE_KEY, lang);
}

export default i18n;
