/**
 * Inbox Capacitor 插件接口
 *
 * 收件箱数据层（Room SQLite）。提供条目与卡片的增删改查与显式生命周期操作。
 */

import { registerPlugin } from '@capacitor/core';
import type { InboxEntry, Flashcard, CardType } from '../lib/anki/types';

/** 页面提交卡片时的草稿结构（不含由数据层赋值的 id/entryId/createdAt/sortOrder/status） */
export interface CardDraft {
  front: string;
  back: string;
  type?: CardType;
  cloze?: string;
  imageUrl?: string;
  tags?: string[];
  /** 来源内容哈希（去重用，由生成侧计算） */
  sourceHash?: string;
}

export interface SaveEntryInput {
  id: string;
  contentType: InboxEntry['contentType'];
  content: string;
  preview: string;
  title?: string;
  extractedText?: string;
  deckName?: string;
  isLocked?: boolean;
  /** 来源内容哈希（去重用） */
  sourceHash?: string;
}

export interface InboxPlugin {
  getAllEntries(): Promise<{ entries: InboxEntry[] }>;
  getEntry(options: { id: string }): Promise<{ entry: InboxEntry; cards: Flashcard[] }>;
  saveEntry(options: { entry: SaveEntryInput }): Promise<void>;
  deleteEntry(options: { id: string }): Promise<void>;
  saveCards(options: { entryId: string; cards: CardDraft[] }): Promise<void>;
  updateCardContent(options: {
    cardId: string;
    front: string;
    back: string;
    cloze?: string;
    imageUrl?: string;
    type?: CardType;
    tags?: string[];
  }): Promise<void>;
  updateCardStatus(options: {
    cardId: string;
    status: Flashcard['status'];
    noteId?: number;
  }): Promise<void>;
  updateCardOrder(options: { cardId: string; sortOrder: number }): Promise<void>;
  updateExtractedContent(options: {
    entryId: string;
    title?: string;
    extractedText: string;
  }): Promise<void>;
  updateDeckName(options: { entryId: string; deckName: string }): Promise<void>;
  lockEntry(options: { entryId: string }): Promise<void>;
  deleteCards(options: { cardIds: string[] }): Promise<void>;
  deleteEntries(options: { ids: string[] }): Promise<void>;
  getStats(options?: {
    from?: number;
    to?: number;
  }): Promise<{ events: Array<{ type: string; count: number; sourceType: string; createdAt: number }> }>;
}

const Inbox = registerPlugin<InboxPlugin>('Inbox');

export default Inbox;
