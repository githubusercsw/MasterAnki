/**
 * WebClipper Capacitor 插件接口
 *
 * 打开应用内浏览器，注入可读性脚本提取网页正文。
 */

import { registerPlugin } from '@capacitor/core';

export interface WebClipperPlugin {
  extract(options: { url: string }): Promise<{ text?: string; title?: string }>;
  open(options: { url: string }): Promise<void>;
}

const WebClipper = registerPlugin<WebClipperPlugin>('WebClipper');

export default WebClipper;
