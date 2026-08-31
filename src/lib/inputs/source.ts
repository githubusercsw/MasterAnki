/**
 * InputSource 输入源抽象
 *
 * 每种输入方式（文本/URL/PDF/语音/图片/YouTube/EPUB/剪贴板）实现为一个插件。
 * 核心管线通过 extract() 获得统一的可读内容，与新输入源解耦。
 */

import type { Plugin } from '../plugins/types';
import type { ExtractedContent, ContentType } from '../anki/types';

export interface InputSource extends Plugin {
  readonly type: 'input';
  readonly capabilities: {
    contentTypes: ContentType[];
    needsNetwork: boolean;
  };

  /** 将原始输入转为可读文本内容 */
  extract(raw: unknown): Promise<ExtractedContent>;
}
