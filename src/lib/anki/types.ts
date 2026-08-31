/**
 * 全局数据模型定义（MasterAnki）
 *
 * 与 MasterFlasher 的字段语义等价，但为全新实现：
 * - 卡片类型扩展为 basic / cloze / image_occlusion
 * - 内容类型扩展为 text / url / pdf / voice / image / youtube / epub
 * - 卡片携带 noteId（AnkiDroid note 映射，供编辑同步）
 * - 卡片携带 sortOrder（拖拽排序持久化）
 */

export type CardType = 'basic' | 'cloze' | 'image_occlusion';

export type ContentType =
  | 'text'
  | 'url'
  | 'pdf'
  | 'voice'
  | 'image'
  | 'youtube'
  | 'epub';

export type CardStatus = 'pending' | 'added' | 'error';

/** 收件箱条目（一次分享/一次输入的载体） */
export interface InboxEntry {
  id: string;
  contentType: ContentType;
  /** text: 实际文本；url: URL；pdf: Capacitor 文件 URL；image: 图片 dataURL/URI */
  content: string;
  preview: string;
  title?: string;
  /** 提取后的可读文本（URL/PDF/EPUB 等） */
  extractedText?: string;
  deckName?: string;
  isLocked: boolean;
  createdAt: number;
}

/** 生成的闪卡 */
export interface Flashcard {
  id: string;
  entryId: string;
  type: CardType;
  front: string;
  back: string;
  /** Cloze 专用：带 {{c1::...}} 标记的原文 */
  cloze?: string;
  /** Image Occlusion 专用 */
  imageUrl?: string;
  tags: string[];
  /** 来源内容哈希（去重用） */
  sourceHash?: string;
  /** AnkiDroid note id（编辑同步依赖） */
  noteId?: number;
  sortOrder: number;
  status: CardStatus;
  createdAt: number;
  updatedAt?: number;
}

/** 卡片集（增量更新的单位） */
export interface CardSet {
  id: string;
  deck: string;
  cards: Flashcard[];
  sourceHash: string;
  sourceType: ContentType;
  sourceUrl?: string;
  createdAt: number;
  updatedAt?: number;
}

/** 提取后的可读内容 */
export interface ExtractedContent {
  text: string;
  title?: string;
  url?: string;
  images?: string[];
}

/** 提交给 AnkiDroid 的 note 结构 */
export interface AnkiNote {
  deckName: string;
  modelKey: string;
  fields: Record<string, string>;
  tags?: string[];
}

/** 事实（三步管线中间产物） */
export interface Fact {
  id: string;
  fact: string;
}

export interface FactsResponse {
  sourceTitle?: string;
  facts: Fact[];
}

export interface FlashcardsResponse {
  deck: string;
  cards: Flashcard[];
}

/** 学习统计事件 */
export interface StatsEvent {
  id: string;
  type: 'card_generated' | 'card_added' | 'source_shared';
  count: number;
  sourceType?: ContentType;
  providerId?: string;
  createdAt: number;
}
