/**
 * 文本输入源
 *
 * 纯文本内容直接作为可读内容，无需额外处理。
 */

import type { InputSource } from '../source';
import type { ExtractedContent, ContentType } from '../../anki/types';

export class TextInputSource implements InputSource {
  readonly id = 'text';
  readonly displayName = 'Text';
  readonly type = 'input' as const;
  readonly capabilities = { contentTypes: ['text'] as ContentType[], needsNetwork: false };

  async extract(raw: unknown): Promise<ExtractedContent> {
    const text = typeof raw === 'string' ? raw : String(raw ?? '');
    return { text: text.trim(), title: 'Shared Text' };
  }
}
