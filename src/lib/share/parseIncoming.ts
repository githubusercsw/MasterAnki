/**
 * 分享内容解析
 *
 * 将来自其他应用的分享（文本/URL/文件）解析为统一结构，
 * 交给对应 InputSource 进一步提取。
 */

import ShareReceiver from '../../plugins/ShareReceiver';
import type { ContentType } from '../anki/types';

export interface IncomingShare {
  mode: 'text' | 'url';
  content: string;
}

export async function parseIncomingShare(): Promise<IncomingShare | null> {
  try {
    const result = await ShareReceiver.getSharedText();
    if (!result.value || !result.mode) return null;
    return { mode: result.mode, content: result.value };
  } catch (e) {
    console.warn('Error parsing incoming share:', e);
    return null;
  }
}

/** 根据内容启发式推断内容类型 */
export function detectContentType(content: string, hint?: ContentType): ContentType {
  if (hint) return hint;
  const trimmed = content.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  return 'text';
}
