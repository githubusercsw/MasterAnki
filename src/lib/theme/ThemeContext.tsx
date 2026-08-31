/**
 * 主题上下文（ThemeContext）
 *
 * 深色模式治理：
 * - 三种模式：浅色 / 深色 / 跟随系统
 * - 持久化到 ConfigSource（key: masteranki:theme），启动恢复
 * - 通过 `.ion-palette-dark` 类驱动 Ionic + 自定义 CSS 变量
 *
 * 环境解耦：依赖注入 PluginContext，不直接触碰 Capacitor 插件。
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { PluginContext } from '../plugins/types';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'masteranki:theme';
const VALID: ThemeMode[] = ['light', 'dark', 'system'];

export interface ThemeState {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState>({ mode: 'system', setMode: () => {} });

export const useTheme = (): ThemeState => useContext(ThemeContext);

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** 应用主题：切换 html 上的 .ion-palette-dark 类，并同步原生 color-scheme */
function applyTheme(mode: ThemeMode): void {
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('ion-palette-dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ ctx: PluginContext; children: React.ReactNode }> = ({
  ctx,
  children,
}) => {
  const [mode, setModeState] = useState<ThemeMode>('system');

  // 启动恢复持久化主题
  useEffect(() => {
    let active = true;
    ctx
      .getSetting(THEME_KEY)
      .then((v) => {
        if (!active) return;
        if (VALID.includes(v as ThemeMode)) setModeState(v as ThemeMode);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ctx]);

  // 应用主题 + 跟随系统变化
  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;

    const onSystemChange = () => applyTheme('system');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onSystemChange);
    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', onSystemChange);
    };
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    void ctx.setSetting(THEME_KEY, m);
  };

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
};
