/**
 * JSON 结构校验
 *
 * 对 LLM 返回的 JSON 做统一容错与白名单校验。
 * 卡片类型从单一 'basic' 扩展为白名单联合类型，缺省字段做归一化。
 */

import type { CardType, FactsResponse, FlashcardsResponse, Flashcard } from '../anki/types';

const CARD_TYPES: CardType[] = ['basic', 'cloze', 'image_occlusion'];

export function validateFactsResponse(data: unknown): FactsResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON: Root must be an object');
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.facts)) {
    throw new Error('Invalid Schema: "facts" must be an array');
  }
  const facts = obj.facts
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      id: typeof f.id === 'string' && f.id ? f.id : crypto.randomUUID(),
      fact: typeof f.fact === 'string' ? f.fact.trim() : '',
    }))
    .filter((f) => f.fact.length > 0);

  return {
    sourceTitle: typeof obj.sourceTitle === 'string' ? obj.sourceTitle : undefined,
    facts,
  };
}

function normalizeCard(c: Record<string, unknown>): Flashcard | null {
  const type = (c.type as CardType) ?? 'basic';
  if (!CARD_TYPES.includes(type)) return null;

  const front = typeof c.front === 'string' ? c.front.trim() : '';
  const back = typeof c.back === 'string' ? c.back.trim() : '';
  if (!front || !back) return null;

  const tags = Array.isArray(c.tags)
    ? c.tags.filter((t): t is string => typeof t === 'string')
    : [];

  return {
    id: typeof c.id === 'string' && c.id ? c.id : crypto.randomUUID(),
    entryId: '',
    type,
    front,
    back,
    cloze: typeof c.cloze === 'string' ? c.cloze : undefined,
    imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
    tags,
    sourceHash: typeof c.sourceHash === 'string' ? c.sourceHash : undefined,
    sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : 0,
    status: 'pending',
    createdAt: Date.now(),
  };
}

export function validateFlashcardsResponse(data: unknown): FlashcardsResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON: Root must be an object');
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.cards)) {
    throw new Error('Invalid Schema: "cards" must be an array');
  }

  const cards = obj.cards
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map(normalizeCard)
    .filter((c): c is Flashcard => c !== null);

  return {
    deck: typeof obj.deck === 'string' && obj.deck ? obj.deck : 'MasterAnki',
    cards,
  };
}

/** 校验单个卡片类型是否合法 */
export function isValidCardType(t: string): t is CardType {
  return (CARD_TYPES as string[]).includes(t);
}
