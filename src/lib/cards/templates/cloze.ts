/**
 * Cloze 卡片模板（填空题）
 *
 * 卡片内容需含 {{c1::答案}} 标记；渲染时从 cloze 字段或 front 中提取。
 */

import type { CardTemplate, RenderedCard } from '../template';
import type { Flashcard } from '../../anki/types';
import { MODEL_KEYS } from '../../anki/ankidroid';

export class ClozeTemplate implements CardTemplate {
  readonly id = 'cloze';
  readonly displayName = 'Cloze (Fill-in-the-blank)';
  readonly type = 'card' as const;
  readonly cardType = 'cloze' as const;
  readonly capabilities = { requiresModel: MODEL_KEYS.cloze, needsImage: false };

  render(card: Flashcard): RenderedCard {
    const text = card.cloze ?? card.front;
    return {
      front: text,
      back: card.back || text,
      fields: { Text: text, Extra: card.back ?? '' },
    };
  }
}
