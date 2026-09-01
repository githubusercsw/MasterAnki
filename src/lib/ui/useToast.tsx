/**
 * useToast — 统一异步反馈（IonToast 轻量封装）
 *
 * 解决各页面用单个 message 字符串 + IonCard 平铺展示反馈的问题：
 * - 成功/错误分级（success / danger 颜色）
 * - 自动消失（成功 2.5s / 错误 4s，错误稍长以便阅读）
 * - 避免与持久性状态提示（loadFailed 等）混用：本 hook 仅承载瞬时操作结果
 */

import { useState, useCallback } from 'react';
import { IonToast } from '@ionic/react';

export type ToastLevel = 'success' | 'error' | 'info';

export interface ToastState {
  open: boolean;
  message: string;
  level: ToastLevel;
}

export interface UseToastResult {
  /** 渲染到 JSX 的 <IonToast>（调用方须放置一次） */
  toast: React.ReactElement;
  /** 展示瞬时反馈 */
  show: (message: string, level?: ToastLevel) => void;
}

export function useToast(): UseToastResult {
  const [state, setState] = useState<ToastState>({ open: false, message: '', level: 'success' });

  const show = useCallback((message: string, level: ToastLevel = 'success') => {
    setState({ open: true, message, level });
  }, []);

  const colorFor = (level: ToastLevel): string => {
    switch (level) {
      case 'error':
        return 'danger';
      case 'info':
        return 'medium';
      default:
        return 'success';
    }
  };

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const toast = (
    <IonToast
      isOpen={state.open}
      message={state.message}
      duration={state.level === 'error' ? 4000 : state.level === 'info' ? 3000 : 2500}
      color={colorFor(state.level)}
      position="bottom"
      onDidDismiss={dismiss}
    />
  );

  return { toast, show };
}
