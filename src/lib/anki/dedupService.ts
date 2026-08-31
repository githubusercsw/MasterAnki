/**
 * 去重服务（dedupService）
 *
 * 在 dedup.ts 纯函数（sha256/normalize/similarity）之上，提供与数据层配合的业务逻辑：
 * - 同源查重：基于来源内容哈希，判断新内容是否与已有条目重复
 * - 变更摘要：当同源条目已存在卡片时，对比新旧卡片，产出"新增/变更/无变化"摘要，
 *   供人工确认门展示（自动化缺把关的治理：任何增量更新必须先出摘要、人工确认）
 *
 * 纯逻辑 + 依赖注入（传入已有条目/卡片），不直接触碰 Capacitor 插件，便于单元测试。
 */

import { computeSourceHash, isNearDuplicate } from './dedup';
import type { Flashcard } from './types';

/** 参与同源查重的已有条目最小引用 */
export interface ExistingEntryRef {
  id: string;
  sourceHash?: string;
  title?: string;
  createdAt: number;
  /** 仅 checkDuplicateText 需要：已有条目的提取文本（用于语义相似度） */
  text?: string;
}

export interface DuplicateCheckResult {
  /** 是否与已有来源精确重复（哈希命中） */
  isDuplicate: boolean;
  /** 是否近似重复（文本级语义，仅 checkDuplicateText 可判断） */
  isNearDuplicate: boolean;
  /** 命中的已有条目 */
  matchedEntry?: ExistingEntryRef;
  /** 新内容自身的哈希 */
  hash: string;
}

/**
 * 同源查重（哈希级）：计算新内容哈希，与已有条目 sourceHash 精确比对。
 * 只有哈希、无原文，无法做语义相似度——近似重复判断交给 checkDuplicateText。
 */
export async function checkDuplicateSource(
  content: string,
  existing: ExistingEntryRef[]
): Promise<DuplicateCheckResult> {
  const hash = await computeSourceHash(content);
  const matchedEntry = existing.find((ref) => ref.sourceHash === hash);
  return {
    isDuplicate: !!matchedEntry,
    isNearDuplicate: false,
    matchedEntry,
    hash,
  };
}

/**
 * 文本级同源查重：有原文时，先哈希精确匹配，再用字符级相似度判断近似重复。
 * 用于"同一 URL 二次分享、排版略有差异"的语义去重。
 */
export async function checkDuplicateText(
  content: string,
  existing: Array<ExistingEntryRef & { text?: string }>,
  threshold = 0.9
): Promise<DuplicateCheckResult> {
  const hash = await computeSourceHash(content);
  let matchedEntry: ExistingEntryRef | undefined;

  for (const ref of existing) {
    if (ref.sourceHash === hash) {
      matchedEntry = ref;
      break;
    }
    // 语义近似：仅对具有原文的条目做相似度比对，避免无意义计算
    if (!matchedEntry && ref.text && (await isNearDuplicate(content, ref.text, threshold))) {
      matchedEntry = ref;
    }
  }

  return {
    isDuplicate: !!matchedEntry && matchedEntry.sourceHash === hash,
    isNearDuplicate: !!matchedEntry && matchedEntry.sourceHash !== hash,
    matchedEntry,
    hash,
  };
}

/** 变更摘要：对比同源条目旧卡片与新生成卡片 */
export interface CardChangeSummary {
  /** 新增卡片（仅存在于新列表） */
  added: Flashcard[];
  /** 无变化卡片（新旧内容一致） */
  unchanged: Flashcard[];
  /** 有变化的卡片（同键但内容不同） */
  changed: Array<{ before: Flashcard; after: Flashcard }>;
  /** 待删除卡片（仅存在于旧列表——增量更新时被替换的旧卡） */
  removed: Flashcard[];
}

/** 卡片内容是否一致（front/back/type/cloze 全比对） */
function cardContentEqual(a: Flashcard, b: Flashcard): boolean {
  return (
    a.front === b.front &&
    a.back === b.back &&
    a.type === b.type &&
    (a.cloze ?? '') === (b.cloze ?? '')
  );
}

/** 卡片匹配键（front+type，用于新旧对应） */
function cardKey(c: Flashcard): string {
  return `${c.type}:${c.front}`;
}

/**
 * 构建变更摘要。
 *
 * @param before 同源条目已有卡片
 * @param after 新生成的卡片
 */
export function buildChangeSummary(before: Flashcard[], after: Flashcard[]): CardChangeSummary {
  const byKey = new Map<string, Flashcard>();
  for (const c of before) {
    byKey.set(cardKey(c), c);
  }

  const added: Flashcard[] = [];
  const unchanged: Flashcard[] = [];
  const changed: Array<{ before: Flashcard; after: Flashcard }> = [];
  const matchedKeys = new Set<string>();

  for (const next of after) {
    const prev = byKey.get(cardKey(next));
    if (!prev) {
      added.push(next);
      continue;
    }
    matchedKeys.add(cardKey(next));
    if (cardContentEqual(prev, next)) {
      unchanged.push(next);
    } else {
      changed.push({ before: prev, after: next });
    }
  }

  // 旧卡片中未匹配到新卡片的 → 视为待删除（增量更新替换语义）
  const removed = before.filter((c) => !matchedKeys.has(cardKey(c)));

  return { added, unchanged, changed, removed };
}

/** 变更摘要是否非空（有新增/变更/删除中的任意一项） */
export function hasChanges(summary: CardChangeSummary): boolean {
  return summary.added.length > 0 || summary.changed.length > 0 || summary.removed.length > 0;
}
