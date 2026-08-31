/**
 * export 序列化单元测试
 *
 * 覆盖：JSON 序列化结构、CSV 头与转义、无卡片条目导出
 */

import { describe, it, expect } from 'vitest';
import { serializeJson, serializeCsv, type ExportRecord } from './export';
import type { InboxEntry, Flashcard } from './types';

function makeEntry(partial: Partial<InboxEntry> & { id: string }): InboxEntry {
  return {
    contentType: 'text',
    content: 'source text',
    preview: 'preview',
    isLocked: false,
    createdAt: 1000,
    ...partial,
  };
}

function makeCard(partial: Partial<Flashcard> & { front: string }): Flashcard {
  return {
    id: 'c1',
    entryId: 'e1',
    type: 'basic',
    back: `back ${partial.front}`,
    tags: ['tag1', 'tag2'],
    sortOrder: 0,
    status: 'pending',
    createdAt: 2000,
    ...partial,
  };
}

const records: ExportRecord[] = [
  {
    entry: makeEntry({ id: 'e1', title: 'Physics', deckName: 'MasterAnki' }),
    cards: [
      makeCard({ id: 'c1', front: 'F=ma' }),
      makeCard({ id: 'c2', front: 'v = at', type: 'cloze', cloze: 'v = {{c1::at}}' }),
    ],
  },
  {
    entry: makeEntry({ id: 'e2', title: 'No cards' }),
    cards: [],
  },
];

describe('serializeJson', () => {
  it('包含元信息与全部记录', () => {
    const data = JSON.parse(serializeJson(records));
    expect(data.app).toBe('MasterAnki');
    expect(data.count).toBe(2);
    expect(data.records).toHaveLength(2);
    expect(data.records[0].entry.id).toBe('e1');
    expect(data.records[0].cards).toHaveLength(2);
    expect(data.records[1].cards).toHaveLength(0);
  });

  it('卡片携带去重/排序字段', () => {
    const data = JSON.parse(serializeJson(records));
    const card = data.records[0].cards[0];
    expect(card).toHaveProperty('sourceHash');
    expect(card).toHaveProperty('sortOrder');
    expect(card).toHaveProperty('status');
    expect(card).toHaveProperty('noteId');
  });

  it('可解析回合法 JSON', () => {
    expect(() => JSON.parse(serializeJson(records))).not.toThrow();
  });
});

describe('serializeCsv', () => {
  it('首行为表头', () => {
    const csv = serializeCsv(records);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('entry_id');
    expect(firstLine).toContain('front');
    expect(firstLine).toContain('sort_order');
    expect(firstLine).toContain('status');
  });

  it('每张卡片占一行（含无卡片条目的条目行）', () => {
    const csv = serializeCsv(records);
    const lines = csv.split('\n').filter((l) => l.length > 0);
    // 表头 + 2 卡片 + 1 无卡片条目 = 4 行
    expect(lines).toHaveLength(4);
  });

  it('含逗号/引号字段被正确转义', () => {
    const r: ExportRecord[] = [
      {
        entry: makeEntry({ id: 'e9' }),
        cards: [makeCard({ id: 'c9', front: 'Front, with "quotes"' })],
      },
    ];
    const csv = serializeCsv(r);
    const lines = csv.split('\n');
    const dataLine = lines[1];
    // 含逗号字段应被双引号包裹
    expect(dataLine).toContain('"Front, with ""quotes"""');
  });

  it('标签以空格连接', () => {
    const csv = serializeCsv(records);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('tag1 tag2');
  });
});
