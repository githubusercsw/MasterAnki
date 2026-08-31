/**
 * Basic 卡片模板（正反面）
 */

import type { CardTemplate, RenderedCard } from '../template';
import type { Flashcard } from '../../anki/types';
import { MODEL_KEYS } from '../../anki/ankidroid';

export class BasicTemplate implements CardTemplate {
  readonly id = 'basic';
  readonly displayName = 'Basic (Q&A)';
  readonly type = 'card' as const;
  readonly cardType = 'basic' as const;
  readonly capabilities = { requiresModel: MODEL_KEYS.basic, needsImage: false };

  render(card: Flashcard): RenderedCard {
    return {
      front: card.front,
      back: card.back,
      fields: { Front: card.front, Back: card.back },
    };
  }
}
