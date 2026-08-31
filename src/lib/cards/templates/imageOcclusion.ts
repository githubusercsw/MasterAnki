/**
 * Image Occlusion 卡片模板（图片遮挡）
 *
 * 依赖 AnkiDroid 的 Image Occlusion Enhanced 插件；未安装时由 UI 层禁用该选项。
 */

import type { CardTemplate, RenderedCard } from '../template';
import type { Flashcard } from '../../anki/types';
import { MODEL_KEYS } from '../../anki/ankidroid';

export const IO_PLUGIN_ID = 'ankidroid.ioenhanced';

export class ImageOcclusionTemplate implements CardTemplate {
  readonly id = 'image_occlusion';
  readonly displayName = 'Image Occlusion';
  readonly type = 'card' as const;
  readonly cardType = 'image_occlusion' as const;
  readonly capabilities = { requiresModel: MODEL_KEYS.image_occlusion, needsImage: true };

  render(card: Flashcard): RenderedCard {
    const image = card.imageUrl ?? '';
    const remarks = card.back ?? '';
    return {
      front: `Image: ${image}`,
      back: remarks,
      fields: { Image: image, Occlusion: '', Remarks: remarks },
    };
  }
}
