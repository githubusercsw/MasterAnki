/**
 * AnkiBackend 抽象接口
 *
 * 当前实现 AnkiDroid；未来可扩展 Anki 桌面、AnkiWeb 等。
 * 能力声明 canUpdateNote / supportedModels 决定编辑与模板可用性。
 */

import type { Plugin } from '../plugins/types';
import type { AnkiNote, CardType } from '../anki/types';

export interface AnkiBackend extends Plugin {
  readonly type: 'anki';
  readonly capabilities: {
    canUpdateNote: boolean;
    supportedModels: CardType[];
  };

  /** 创建牌组（已存在则幂等） */
  createDeck(name: string): Promise<void>;

  /** 创建/获取 note model（已存在则幂等） */
  ensureModel(modelKey: string, fields: string[], templates: ModelTemplate[]): Promise<void>;

  /** 新增 note，返回 noteId */
  addNote(note: AnkiNote): Promise<number>;

  /** 更新已有 note（若 capabilities.canUpdateNote 为 false 则抛错） */
  updateNote(noteId: number, note: AnkiNote): Promise<void>;

  /** 检测插件/依赖是否可用（如 Image Occlusion Enhanced） */
  checkDependency(depId: string): Promise<boolean>;
}

export interface ModelTemplate {
  name: string;
  qfmt: string;
  afmt: string;
}

/** Anki note model 定义（模型管理用） */
export interface NoteModel {
  key: string;
  fields: string[];
  templates: ModelTemplate[];
}
