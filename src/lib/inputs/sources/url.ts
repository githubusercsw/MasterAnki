/**
 * URL 输入源
 *
 * 通过 WebClipper 插件读取 URL 页面内容（注入可读性提取），
 * 或回退到服务端抓取不可用时由用户确认。
 */

import type { InputSource } from '../source';
import type { ExtractedContent, ContentType } from '../../anki/types';
import WebClipper from '../../../plugins/WebClipper';

export class UrlInputSource implements InputSource {
  readonly id = 'url';
  readonly displayName = 'URL';
  readonly type = 'input' as const;
  readonly capabilities = { contentTypes: ['url'] as ContentType[], needsNetwork: true };

  async extract(raw: unknown): Promise<ExtractedContent> {
    const url = typeof raw === 'string' ? raw.trim() : '';
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Invalid URL');
    }
    try {
      const res = await WebClipper.extract({ url });
      return {
        text: res.text ?? '',
        title: res.title ?? url,
        url,
      };
    } catch {
      // 原生插件不可用（Web 开发环境），提示需要用户手动粘贴
      throw new Error(
        'URL extraction requires the native WebClipper. Paste content manually on web.'
      );
    }
  }
}
