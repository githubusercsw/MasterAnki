/**
 * AnkiDroid Web 降级实现
 *
 * Web（浏览器）环境无 AnkiDroid 原生 API。
 * - checkDependency / isAvailable 返回不可用（前端据此禁用 IO 等）。
 * - 写操作抛明确错误，避免静默失败。
 */

import type { AnkiDroidPlugin, AnkiModelInfo, AnkiDeckInfo } from '../AnkiDroid';

function nativeOnly(op: string): never {
  throw new Error(`AnkiDroid.${op} 仅在 Android 原生环境可用（Web 开发环境不可用）`);
}

/** Web 环境内置模型列表（与前端 MODEL_KEYS 对齐） */
const BUILTIN_MODELS: AnkiModelInfo[] = [
  { id: 1, name: 'Basic', fields: ['Front', 'Back'] },
  { id: 2, name: 'Cloze', fields: ['Text', 'Extra'] },
  { id: 3, name: 'Image Occlusion', fields: ['Image', 'Occlusion', 'Remarks'] },
];

/** Web 环境内置牌组列表（与默认牌组名对齐） */
const BUILTIN_DECKS: AnkiDeckInfo[] = [{ id: 1, name: 'MasterAnki' }];

export const webAnkiDroid: AnkiDroidPlugin = {
  async createDeck() {
    nativeOnly('createDeck');
  },

  async getModels() {
    return { models: BUILTIN_MODELS };
  },

  async getDecks() {
    return { decks: BUILTIN_DECKS };
  },

  async ensureModel() {
    nativeOnly('ensureModel');
  },

  async addNote() {
    nativeOnly('addNote');
  },

  async updateNote() {
    nativeOnly('updateNote');
  },

  async checkDependency() {
    // Web 环境视为不可用（前端据此禁用依赖该插件的功能，如 Image Occlusion）
    return { available: false };
  },
};
