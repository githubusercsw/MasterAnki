/**
 * AnkiDroid Capacitor 插件接口
 *
 * 声明与 Android 原生插件的通信协议。
 */

import { registerPlugin } from '@capacitor/core';
import type { AnkiNote } from '../lib/anki/types';
import { webAnkiDroid } from './web/ankidroidWeb';

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
}

const AnkiDroid = registerPlugin<AnkiDroidPlugin>('AnkiDroid', { web: () => webAnkiDroid });

export default AnkiDroid;
