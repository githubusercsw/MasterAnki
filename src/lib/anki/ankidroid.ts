/**
 * AnkiDroid Backend 实现
 *
 * 通过 Capacitor 原生插件与 AnkiDroid 通信：
 * 建牌组、建 model、增删改 note。
 * 当前实现为插件接口代理层；具体 native 逻辑由 Android 侧插件承载。
 */

import type { AnkiBackend, NoteModel } from './backend';
import type { AnkiNote, CardType } from './types';
import AnkiDroid from '../../plugins/AnkiDroid';
import type { PluginContext } from '../plugins/types';

/** 本项目各卡片类型对应的 note model key */
export const MODEL_KEYS: Record<CardType, string> = {
  basic: 'com.masteranki.basic',
  cloze: 'com.masteranki.cloze',
  image_occlusion: 'com.masteranki.image_occlusion',
};

/** 各卡片类型 model 定义（含模板） */
export const MODELS: Record<CardType, NoteModel> = {
  basic: {
    key: MODEL_KEYS.basic,
    fields: ['Front', 'Back'],
    templates: [
      { name: 'Card 1', qfmt: '{{Front}}', afmt: '{{Front}}<hr id="answer">{{Back}}' },
    ],
  },
  cloze: {
    key: MODEL_KEYS.cloze,
    fields: ['Text', 'Extra'],
    templates: [
      { name: 'Cloze', qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Extra}}' },
    ],
  },
  image_occlusion: {
    key: MODEL_KEYS.image_occlusion,
    fields: ['Image', 'Occlusion', 'Remarks'],
    templates: [
      {
        name: 'IO',
        qfmt: '{{Image}}<br>{{Occlusion}}',
        afmt: '{{Image}}<br>{{Occlusion}}<br>{{Remarks}}',
      },
    ],
  },
};

export class AnkiDroidBackend implements AnkiBackend {
  readonly id = 'ankidroid';
  readonly displayName = 'AnkiDroid';
  readonly type = 'anki' as const;
  readonly capabilities = {
    canUpdateNote: true,
    supportedModels: ['basic', 'cloze', 'image_occlusion'] as CardType[],
  };

  async init(_ctx: PluginContext): Promise<void> {
    // 上下文供未来原生能力检测等扩展使用；当前 AnkiDroid 操作直接走插件
  }

  async createDeck(name: string): Promise<void> {
    await AnkiDroid.createDeck({ name });
  }

  async ensureModel(modelKey: string, fields: string[], templates: ModelTemplate[]): Promise<void> {
    await AnkiDroid.ensureModel({ modelKey, fields, templates });
  }

  async addNote(note: AnkiNote): Promise<number> {
    const res = await AnkiDroid.addNote({ note });
    return res.noteId ?? -1;
  }

  async updateNote(noteId: number, note: AnkiNote): Promise<void> {
    await AnkiDroid.updateNote({ noteId, note });
  }

  async checkDependency(depId: string): Promise<boolean> {
    const res = await AnkiDroid.checkDependency({ depId });
    return res.available ?? false;
  }
}

/** 供模板引用的类型别名 */
type ModelTemplate = { name: string; qfmt: string; afmt: string };
