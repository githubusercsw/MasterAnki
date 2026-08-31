/**
 * CardTemplate 卡片模板抽象
 *
 * 每种题型（Basic/Cloze/Image Occlusion）实现为一个插件。
 * 决定渲染方式与所需 Anki model，以及生成提示词。
 */

import type { Plugin } from '../plugins/types';
import type { Flashcard, CardType } from '../anki/types';

export interface RenderedCard {
  front: string;
  back: string;
  /** Anki 字段（写入 note 时用） */
  fields: Record<string, string>;
}

export interface CardTemplate extends Plugin {
  readonly type: 'card';
  readonly cardType: CardType;
  readonly capabilities: {
    requiresModel: string;
    needsImage: boolean;
  };

  /** 将卡片渲染为可展示的 front/back */
  render(card: Flashcard): RenderedCard;
}
