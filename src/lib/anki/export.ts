/**
 * 批量导出（export）
 *
 * 将收件箱条目与卡片序列化为 JSON / CSV，并触发下载。
 * 纯逻辑 + 浏览器下载封装，便于单元测试序列化部分。
 */

import type { InboxEntry, Flashcard } from './types';

/** 导出记录（条目 + 其卡片） */
export interface ExportRecord {
  entry: InboxEntry;
  cards: Flashcard[];
}

/* ---------------- JSON ---------------- */

/** 序列化为 JSON 字符串（含元信息与时间戳） */
export function serializeJson(records: ExportRecord[]): string {
  return JSON.stringify(
    {
      app: 'MasterAnki',
      exportedAt: new Date().toISOString(),
      count: records.length,
      records: records.map(({ entry, cards }) => ({
        entry: {
          id: entry.id,
          contentType: entry.contentType,
          content: entry.content,
          preview: entry.preview,
          title: entry.title,
          deckName: entry.deckName,
          isLocked: entry.isLocked,
          createdAt: entry.createdAt,
        },
        cards: cards.map((c) => ({
          id: c.id,
          entryId: c.entryId,
          type: c.type,
          front: c.front,
          back: c.back,
          cloze: c.cloze ?? null,
          imageUrl: c.imageUrl ?? null,
          tags: c.tags,
          sourceHash: c.sourceHash ?? null,
          noteId: c.noteId ?? null,
          sortOrder: c.sortOrder,
          status: c.status,
          createdAt: c.createdAt,
        })),
      })),
    },
    null,
    2
  );
}

/* ---------------- CSV ---------------- */

/** CSV 转义（双引号包裹含分隔符/引号/换行的字段） */
function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * 序列化为 CSV（每行一条卡片，条目级字段冗余展开到每行）。
 * 列：entry_id, content_type, deck, title, card_id, type, front, back,
 *     cloze, tags, source_hash, note_id, sort_order, status, created_at
 */
export function serializeCsv(records: ExportRecord[]): string {
  const header = [
    'entry_id',
    'content_type',
    'deck',
    'title',
    'card_id',
    'type',
    'front',
    'back',
    'cloze',
    'tags',
    'source_hash',
    'note_id',
    'sort_order',
    'status',
    'created_at',
  ].join(',');

  const rows = records.flatMap(({ entry, cards }) => {
    if (cards.length === 0) {
      // 无卡片的条目也导出（便于完整备份）
      return [
        [
          entry.id,
          entry.contentType,
          entry.deckName ?? '',
          entry.title ?? '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          String(entry.createdAt),
        ].join(','),
      ];
    }
    return cards.map((c) =>
      [
        entry.id,
        entry.contentType,
        entry.deckName ?? '',
        entry.title ?? '',
        c.id,
        c.type,
        c.front,
        c.back,
        c.cloze ?? '',
        c.tags.join(' '),
        c.sourceHash ?? '',
        c.noteId ?? '',
        String(c.sortOrder ?? 0),
        c.status,
        String(c.createdAt ?? ''),
      ]
        .map(csvEscape)
        .join(',')
    );
  });

  return [header, ...rows].join('\n');
}

/* ---------------- 下载 ---------------- */

/** 触发浏览器下载（Web 环境可用；原生环境可换 Filesystem 写入） */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(records: ExportRecord[], filename = 'masteranki-export.json'): void {
  downloadText(filename, serializeJson(records), 'application/json');
}

export function downloadCsv(records: ExportRecord[], filename = 'masteranki-export.csv'): void {
  downloadText(filename, serializeCsv(records), 'text/csv;charset=utf-8');
}
