/**
 * dedupService 单元测试
 *
 * 覆盖：同源查重（哈希级/文本级）、变更摘要（新增/无变化/变更/移除）、hasChanges
 */

import { describe, it, expect } from 'vitest';
import {
  checkDuplicateSource,
  checkDuplicateText,
  buildChangeSummary,
  hasChanges,
  type ExistingEntryRef,
} from './dedupService';
import { computeSourceHash } from './dedup';
import type { Flashcard } from './types';

function makeCard(partial: Partial<Flashcard> & { front: string }): Flashcard {
  return {
    id: `card-${partial.front}`,
    entryId: 'entry-1',
    type: 'basic',
    back: `back of ${partial.front}`,
    tags: [],
    sortOrder: 0,
    status: 'pending',
    createdAt: 0,
    ...partial,
  };
}

describe('checkDuplicateSource（哈希级同源查重）', () => {
  it('相同内容哈希命中已有条目', async () => {
    const content = 'Anki is a spaced repetition software.';
    const hash = await computeSourceHash(content);
    const existing: ExistingEntryRef[] = [{ id: 'a', sourceHash: hash, createdAt: 1 }];
    const res = await checkDuplicateSource(content, existing);
    expect(res.isDuplicate).toBe(true);
    expect(res.matchedEntry?.id).toBe('a');
    expect(res.hash).toBe(hash);
  });

  it('不同内容不判为重复', async () => {
    const existing: ExistingEntryRef[] = [{ id: 'a', sourceHash: 'abc123', createdAt: 1 }];
    const res = await checkDuplicateSource('totally different content', existing);
    expect(res.isDuplicate).toBe(false);
    expect(res.matchedEntry).toBeUndefined();
  });

  it('无哈希的已有条目被跳过', async () => {
    const res = await checkDuplicateSource('some content', [{ id: 'a', createdAt: 1 }]);
    expect(res.isDuplicate).toBe(false);
  });
});

describe('checkDuplicateText（文本级语义查重）', () => {
  it('排版差异（多余空格/换行）仍判为精确重复', async () => {
    const a = 'Anki is a spaced repetition software.';
    const b = 'Anki   is a spaced\nrepetition software.';
    const hash = await computeSourceHash(b);
    const res = await checkDuplicateText(b, [{ id: 'a', sourceHash: hash, text: a, createdAt: 1 }]);
    expect(res.isDuplicate).toBe(true);
  });

  it('近似文本命中语义相似（低于阈值不命中）', async () => {
    const a = 'Anki is a spaced repetition software that helps memorization.';
    const b = 'Anki is a spaced repetition software helping you remember.';
    // 默认阈值 0.9 可能不命中，用低阈值验证命中
    const res = await checkDuplicateText(b, [{ id: 'a', text: a, createdAt: 1 }], 0.5);
    expect(res.isDuplicate).toBe(false);
    expect(res.isNearDuplicate).toBe(true);
    expect(res.matchedEntry?.id).toBe('a');
  });
});

describe('buildChangeSummary（变更摘要）', () => {
  it('空旧列表：全部为新增', () => {
    const after = [makeCard({ front: 'A' }), makeCard({ front: 'B' })];
    const s = buildChangeSummary([], after);
    expect(s.added).toHaveLength(2);
    expect(s.unchanged).toHaveLength(0);
    expect(s.changed).toHaveLength(0);
    expect(s.removed).toHaveLength(0);
    expect(hasChanges(s)).toBe(true);
  });

  it('完全相同：无变化', () => {
    const before = [makeCard({ front: 'A' })];
    const after = [makeCard({ front: 'A' })];
    const s = buildChangeSummary(before, after);
    expect(s.added).toHaveLength(0);
    expect(s.unchanged).toHaveLength(1);
    expect(s.changed).toHaveLength(0);
    expect(s.removed).toHaveLength(0);
    expect(hasChanges(s)).toBe(false);
  });

  it('同键内容变更：标为 changed', () => {
    const before = [makeCard({ front: 'A', back: 'old' })];
    const after = [makeCard({ front: 'A', back: 'new' })];
    const s = buildChangeSummary(before, after);
    expect(s.changed).toHaveLength(1);
    expect(s.changed[0].before.back).toBe('old');
    expect(s.changed[0].after.back).toBe('new');
    expect(hasChanges(s)).toBe(true);
  });

  it('旧卡未出现在新列表：标为 removed', () => {
    const before = [makeCard({ front: 'A' }), makeCard({ front: 'X' })];
    const after = [makeCard({ front: 'A' })];
    const s = buildChangeSummary(before, after);
    expect(s.removed).toHaveLength(1);
    expect(s.removed[0].front).toBe('X');
    expect(hasChanges(s)).toBe(true);
  });

  it('front+type 作为匹配键（同 front 不同类型不算同卡）', () => {
    const before = [makeCard({ front: 'Q', type: 'basic' })];
    const after = [makeCard({ front: 'Q', type: 'cloze' })];
    const s = buildChangeSummary(before, after);
    expect(s.removed).toHaveLength(1);
    expect(s.added).toHaveLength(1);
  });
});
