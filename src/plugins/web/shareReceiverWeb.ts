/**
 * ShareReceiver Web 降级实现
 *
 * Web（浏览器）环境：
 * - 接收分享：无系统分享入口，hasPending 恒 false
 * - 分享文本：优先 navigator.share，不可用时回退剪贴板
 */

import type { ShareReceiverPlugin } from '../ShareReceiver';

export const webShareReceiver: ShareReceiverPlugin = {
  async getSharedText() {
    return {};
  },

  async getSharedFile() {
    return {};
  },

  async clear() {
    return;
  },

  async hasPending() {
    return { pending: false, contentType: 'text' };
  },

  async shareText({ text, title }) {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: title ?? 'MasterAnki', text });
        return;
      } catch {
        // 用户取消或失败 → 回退剪贴板
      }
    }
    await navigator.clipboard.writeText(text);
  },
};
