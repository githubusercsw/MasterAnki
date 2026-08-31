/**
 * PDF 输入源
 *
 * 使用 pdf.js 在客户端提取 PDF 文本。异常（加密/扫描件/超大文件）做容错。
 */

import type { InputSource } from '../source';
import type { ExtractedContent, ContentType } from '../../anki/types';

// 动态引入 pdfjs（避免打包时全量加载 worker）
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist');
  }
  return pdfjsPromise;
}

export class PdfInputSource implements InputSource {
  readonly id = 'pdf';
  readonly displayName = 'PDF';
  readonly type = 'input' as const;
  readonly capabilities = { contentTypes: ['pdf'] as ContentType[], needsNetwork: false };

  /** 支持传入 data URL、blob URL 或 Capacitor 文件 URL */
  async extract(raw: unknown): Promise<ExtractedContent> {
    const src = typeof raw === 'string' ? raw : '';
    if (!src) throw new Error('No PDF source provided');

    try {
      const pdfjs = await loadPdfjs();
      const loadingTask = pdfjs.getDocument({ data: await this.toData(src) });
      const pdf = await loadingTask.promise;
      const pages: string[] = [];
      const total = Math.min(pdf.numPages, 200); // 超大文件截断保护
      for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((it: unknown) => (it as { str?: string }).str ?? '')
          .join(' ');
        pages.push(text);
      }
      const text = pages.join('\n\n').trim();
      if (!text) {
        throw new Error('PDF appears to be a scanned document (no extractable text).');
      }
      return { text, title: 'Shared PDF' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PDF extraction failed';
      throw new Error(`PDF extraction failed: ${msg}`);
    }
  }

  private async toData(src: string): Promise<Uint8Array> {
    // blob/data URL 直接使用；文件路径需 fetch 读取（Web 环境）
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      const resp = await fetch(src);
      const buf = await resp.arrayBuffer();
      return new Uint8Array(buf);
    }
    // Capacitor 文件 URL
    const resp = await fetch(src);
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  }
}
