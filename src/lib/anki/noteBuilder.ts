/**
 * 卡片 → AnkiNote 构建（入库/编辑同步共用）
 *
 * 从 Flashcard 构建提交给 AnkiDroid 的 note：
 * - 模型名：优先用户所选 AnkiDroid 真实模板，否则按卡片类型内置映射
 * - 字段：canonical 字段（按卡片类型语义）+ 真实模型字段映射
 * - 牌组名由调用方注入（条目级 deckName 或用户已选牌组）
 */

import { MODELS } from './ankidroid';
import { getSelectedAnkiModel } from './modelSelection';
import { findModelByName, mapFieldsToModel } from './resolveModel';
import type { Flashcard, AnkiNote } from './types';

/** 按卡片类型构建 canonical 字段（Basic/Cloze/IO 语义） */
export function buildCanonicalFields(card: Flashcard): Record<string, string> {
  const canonical: Record<string, string> = {
    Front: card.front,
    Back: card.back,
  };
  if (card.type === 'cloze') {
    canonical.Text = card.cloze ?? card.front;
    canonical.Extra = card.back ?? '';
  }
  if (card.type === 'image_occlusion') {
    canonical.Image = card.imageUrl ?? '';
    canonical.Occlusion = '';
    canonical.Remarks = card.back ?? '';
  }
  return canonical;
}

/**
 * 构建 AnkiNote（含模型解析 + 字段映射）。
 * deckName 由调用方传入（条目/用户所选/默认）。
 */
export async function buildAnkiNote(
  card: Flashcard,
  deckName: string
): Promise<AnkiNote> {
  const builtin = MODELS[card.type];
  const selectedModelName = await getSelectedAnkiModel();
  const modelKey = selectedModelName || builtin.key;

  const canonical = buildCanonicalFields(card);

  let fields: Record<string, string> = canonical;
  if (selectedModelName) {
    // 用户选了真实模板：以其字段名为准映射
    const realModel = await findModelByName(selectedModelName);
    fields = mapFieldsToModel(realModel, canonical, {
      front: card.front,
      back: card.back,
      clozeText: card.cloze ?? card.front,
      imageUrl: card.imageUrl,
    });
  }

  return {
    deckName: deckName || 'MasterAnki',
    modelKey,
    fields,
    tags: card.tags,
  };
}
