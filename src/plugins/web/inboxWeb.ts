/**
 * Inbox Web 降级实现
 *
 * 用 localStorage 镜像原生 Room 的行为，仅供开发调试（npm run dev）。
 * 字段语义与 src/lib/anki/types.ts 一致，与原生 Room 实体对齐。
 */

import type { InboxEntry, Flashcard, CardType } from '../../lib/anki/types';
import type { CardDraft, SaveEntryInput, InboxPlugin } from '../Inbox';

const KEY_ENTRIES = 'ma:entries';
const KEY_CARDS = 'ma:cards';
const KEY_STATS = 'ma:stats';

interface StatsEventRow {
  type: string;
  count: number;
  sourceType: string;
  providerId: string;
  createdAt: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readEntries(): InboxEntry[] {
  return read<InboxEntry[]>(KEY_ENTRIES, []);
}

function writeEntries(entries: InboxEntry[]): void {
  write(KEY_ENTRIES, entries);
}

function readCards(): Flashcard[] {
  return read<Flashcard[]>(KEY_CARDS, []);
}

function writeCards(cards: Flashcard[]): void {
  write(KEY_CARDS, cards);
}

function readStats(): StatsEventRow[] {
  return read<StatsEventRow[]>(KEY_STATS, []);
}

function recordStat(type: string, count: number, sourceType?: string, providerId?: string): void {
  const stats = readStats();
  stats.push({
    type,
    count,
    sourceType: sourceType ?? '',
    providerId: providerId ?? '',
    createdAt: Date.now(),
  });
  write(KEY_STATS, stats);
}

export const webInbox: InboxPlugin = {
  async getAllEntries() {
    return { entries: readEntries() };
  },

  async getEntry({ id }) {
    const entries = readEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) throw new Error('Entry not found: ' + id);
    const cards = readCards()
      .filter((c) => c.entryId === id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return { entry, cards };
  },

  async saveEntry({ entry }: { entry: SaveEntryInput }) {
    const entries = readEntries();
    const now = Date.now();
    const existing = entries.find((e) => e.id === entry.id);
    const merged: InboxEntry = {
      id: entry.id,
      contentType: entry.contentType,
      content: entry.content,
      preview: entry.preview,
      title: entry.title,
      extractedText: entry.extractedText,
      deckName: entry.deckName,
      isLocked: entry.isLocked ?? false,
      createdAt: existing?.createdAt ?? now,
    };
    const idx = entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) entries[idx] = merged;
    else entries.unshift(merged);
    writeEntries(entries);
  },

  async deleteEntry({ id }) {
    writeEntries(readEntries().filter((e) => e.id !== id));
    writeCards(readCards().filter((c) => c.entryId !== id));
  },

  async saveCards({ entryId, cards, providerId }) {
    const all = readCards();
    const now = Date.now();
    const drafts: Flashcard[] = cards.map((c: CardDraft, i: number) => ({
      id: crypto.randomUUID(),
      entryId,
      type: c.type ?? 'basic',
      front: c.front,
      back: c.back,
      cloze: c.cloze,
      imageUrl: c.imageUrl,
      tags: c.tags ?? [],
      sourceHash: c.sourceHash,
      noteId: undefined,
      sortOrder: i,
      status: 'pending',
      createdAt: now,
    }));
    writeCards([...all, ...drafts]);
    recordStat('card_generated', drafts.length, undefined, providerId ?? undefined);
  },

  async updateCardContent({ cardId, front, back, cloze, imageUrl, type, tags }) {
    const cards = readCards();
    const c = cards.find((x) => x.id === cardId);
    if (!c) throw new Error('Card not found: ' + cardId);
    c.front = front;
    c.back = back;
    if (cloze !== undefined) c.cloze = cloze;
    if (imageUrl !== undefined) c.imageUrl = imageUrl;
    if (type !== undefined) c.type = type;
    if (tags !== undefined) c.tags = tags;
    c.updatedAt = Date.now();
    writeCards(cards);
  },

  async updateCardStatus({ cardId, status, noteId }) {
    const cards = readCards();
    const c = cards.find((x) => x.id === cardId);
    if (!c) throw new Error('Card not found: ' + cardId);
    c.status = status;
    if (noteId !== undefined) c.noteId = noteId;
    c.updatedAt = Date.now();
    writeCards(cards);
    if (status === 'added') recordStat('card_added', 1);
  },

  async updateCardOrder({ cardId, sortOrder }) {
    const cards = readCards();
    const c = cards.find((x) => x.id === cardId);
    if (!c) throw new Error('Card not found: ' + cardId);
    c.sortOrder = sortOrder;
    writeCards(cards);
  },

  async updateExtractedContent({ entryId, title, extractedText }) {
    const entries = readEntries();
    const e = entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Entry not found: ' + entryId);
    e.extractedText = extractedText;
    if (title !== undefined) e.title = title;
    writeEntries(entries);
  },

  async updateDeckName({ entryId, deckName }) {
    const entries = readEntries();
    const e = entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Entry not found: ' + entryId);
    e.deckName = deckName;
    writeEntries(entries);
  },

  async lockEntry({ entryId }) {
    const entries = readEntries();
    const e = entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Entry not found: ' + entryId);
    e.isLocked = true;
    writeEntries(entries);
  },

  async deleteCards({ cardIds }) {
    const ids = new Set(cardIds);
    writeCards(readCards().filter((c) => !ids.has(c.id)));
  },

  async deleteEntries({ ids }) {
    const set = new Set(ids);
    writeEntries(readEntries().filter((e) => !set.has(e.id)));
    writeCards(readCards().filter((c) => !set.has(c.entryId)));
  },

  async getStats({ from = 0, to = Number.MAX_SAFE_INTEGER } = {}) {
    const events = readStats()
      .filter((s) => s.createdAt >= from && s.createdAt <= to)
      .map((s) => ({
        type: s.type,
        count: s.count,
        sourceType: s.sourceType,
        providerId: s.providerId,
        createdAt: s.createdAt,
      }));
    return { events };
  },
};

export type { CardType };
