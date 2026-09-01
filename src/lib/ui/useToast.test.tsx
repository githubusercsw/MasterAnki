/**
 * useToast 统一反馈 hook 单测
 *
 * 验证：初始关闭、show 成功/错误/提示三级、消息与时长颜色正确、dismiss 后关闭。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

// IonToast 在 jsdom 下渲染无副作用，直接断言返回元素 props
function toastProps(hook: ReturnType<typeof renderHook<ReturnType<typeof useToast>, never>>) {
  const { toast } = hook.result.current;
  return (
    toast as React.ReactElement<{
      isOpen?: boolean;
      message?: string;
      duration?: number;
      color?: string;
    }>
  ).props;
}

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始状态关闭', () => {
    const hook = renderHook(() => useToast());
    expect(toastProps(hook).isOpen).toBe(false);
  });

  it('show 成功：消息、成功色、较短时长', () => {
    const hook = renderHook(() => useToast());
    act(() => hook.result.current.show('done', 'success'));
    const p = toastProps(hook);
    expect(p.isOpen).toBe(true);
    expect(p.message).toBe('done');
    expect(p.color).toBe('success');
    expect(p.duration).toBe(2500);
  });

  it('show 错误：danger 色、较长时长', () => {
    const hook = renderHook(() => useToast());
    act(() => hook.result.current.show('boom', 'error'));
    const p = toastProps(hook);
    expect(p.isOpen).toBe(true);
    expect(p.message).toBe('boom');
    expect(p.color).toBe('danger');
    expect(p.duration).toBe(4000);
  });

  it('show 提示：medium 色、中等时长', () => {
    const hook = renderHook(() => useToast());
    act(() => hook.result.current.show('note', 'info'));
    const p = toastProps(hook);
    expect(p.color).toBe('medium');
    expect(p.duration).toBe(3000);
  });

  it('默认等级为 success', () => {
    const hook = renderHook(() => useToast());
    act(() => hook.result.current.show('default'));
    const p = toastProps(hook);
    expect(p.color).toBe('success');
  });

  it('onDidDismiss 触发后关闭', () => {
    const hook = renderHook(() => useToast());
    act(() => hook.result.current.show('x'));
    expect(toastProps(hook).isOpen).toBe(true);
    const { onDidDismiss } = toastProps(hook);
    act(() => {
      (onDidDismiss as () => void)();
    });
    expect(toastProps(hook).isOpen).toBe(false);
  });
});
