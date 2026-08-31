/**
 * ShareReceiver Capacitor 插件接口
 *
 * 处理 Android Share Intent：接收来自其他应用分享的文本/URL/PDF 文件。
 */

import { registerPlugin } from '@capacitor/core';
import type { ContentType } from '../lib/anki/types';

export interface IncomingShare {
  mode: 'text' | 'url';
  value: string;
}

export interface SharedFile {
  path: string;
  name?: string;
  mimeType?: string;
}

export interface ShareReceiverPlugin {
  /** 读取最近一次分享的文本/URL（分享进入时静默保存） */
  getSharedText(): Promise<{ value?: string; mode?: 'text' | 'url' }>;
  /** 读取最近一次分享的文件（如 PDF） */
  getSharedFile(): Promise<{ file?: SharedFile }>;
  /** 清空待处理的分享（入库后调用） */
  clear(): Promise<void>;
  /** 检测是否有待处理分享 */
  hasPending(): Promise<{ pending: boolean; contentType?: ContentType }>;
  /** 调起系统分享（长按菜单"分享"用；Web 降级用 navigator.share） */
  shareText(options: { text: string; title?: string }): Promise<void>;
}

const ShareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver');

export default ShareReceiver;
