/**
 * noteBuilder 单测
 *
 * 验证：内置模型路径字段构建 + providerId 统计维度写入（Phase 4 按 Provider 统计）。
 * mock modelSelection（未选模型→走内置）与 secureStorage（providerId）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./modelSelection', () => ({
  __esModule: true,
  getSelectedAnkiModel: vi.fn(async () => null),
}));

vi.mock('../settings/secureStorage', () => ({
  __esModule: true,
  getActiveProviderId: vi.fn(async () => 'test-provider'),
}));

import { buildAnkiNote } from './noteBuilder';
import type { Flashcard } from './types';

beforeEach(() => {
  vi.clearAllMocks();
});

const basicCard: Flashcard = {
  id: 'c1',
  entryId: 'e1',
  type: 'basic',
  front: 'What is 2+2?',
  back: '4',
  tags: ['math'],
  status: 'pending',
  sortOrder: 0,
  createdAt: Date.now(),
};

describe('buildAnkiNote', () => {
  it('内置模型路径：canonical 字段 + deckName + 无 providerId 时 fallback', async () => {
    const note = await buildAnkiNote(basicCard, 'MyDeck');
    expect(note.deckName).toBe('MyDeck');
    expect(note.modelKey).toBe('Basic');
    expect(note.fields.Front).toBe('What is 2+2?');
    expect(note.fields.Back).toBe('4');
    expect(note.tags).toEqual(['math']);
  });

  it('写入 providerId（Phase 4 统计维度）', async () => {
    const note = await buildAnkiNote(basicCard, 'MyDeck');
    expect(note.providerId).toBe('test-provider');
  });

  it('deckName 为空时回退 MasterAnki', async () => {
    const note = await buildAnkiNote(basicCard, '');
    expect(note.deckName).toBe('MasterAnki');
  });
});
