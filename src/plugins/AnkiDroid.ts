/**
 * AnkiDroid Capacitor 插件接口
 *
 * 声明与 Android 原生插件的通信协议。
 */

import { registerPlugin } from '@capacitor/core';
import type { AnkiNote } from '../lib/anki/types';
import { webAnkiDroid } from './web/ankidroidWeb';

export interface AnkiModelInfo {
  id: number;
  name: string;
  fields: string[];
}

export interface AnkiDeckInfo {
  id: number;
  name: string;
}

export interface AnkiDroidPlugin {
  createDeck(options: { name: string }): Promise<void>;
  ensureModel(options: {
    modelKey: string;
    fields: string[];
    templates: Array<{ name: string; qfmt: string; afmt: string }>;
  }): Promise<void>;
  addNote(options: { note: AnkiNote }): Promise<{ noteId?: number }>;
  updateNote(options: { noteId: number; note: AnkiNote }): Promise<void>;
  checkDependency(options: { depId: string }): Promise<{ available?: boolean }>;
  /** 读取 AnkiDroid 中用户实际使用的全部模型 */
  getModels(): Promise<{ models: AnkiModelInfo[] }>;
  /** 读取 AnkiDroid 中用户实际使用的全部牌组 */
  getDecks(): Promise<{ decks: AnkiDeckInfo[] }>;
}

const AnkiDroid = registerPlugin<AnkiDroidPlugin>('AnkiDroid', { web: () => webAnkiDroid });

export default AnkiDroid;
