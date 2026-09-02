/**
 * deckSelection / modelSelection / resolveModel 单测
 *
 * - 牌组/模型选择状态：通过 mock Settings 插件验证持久化往返
 * - resolveModel.mapFieldsToModel：纯函数启发式字段映射
 * - findModelByName：mock AnkiDroid.getModels 验证按名匹配
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted：mock 工厂被提升到模块顶部，需在此声明共享存储，避免 TDZ 引用
const { store } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return { store };
});

// Mock Settings 插件（selection 模块依赖它持久化）
vi.mock('../../plugins/Settings', () => ({
  __esModule: true,
  default: {
    async getSetting({ key }: { key: string }) {
      return { value: store.get(key) ?? null };
    },
    async setSetting({ key, value }: { key: string; value: string }) {
      store.set(key, value);
    },
    async deleteSetting({ key }: { key: string }) {
      store.delete(key);
    },
  },
}));

// Mock AnkiDroid 插件（findModelByName 依赖 getModels）
vi.mock('../../plugins/AnkiDroid', () => {
  return {
    __esModule: true,
    default: {
      async getModels() {
        return {
          models: [
            { id: 1, name: 'Basic', fields: ['Front', 'Back'] },
            { id: 2, name: '自定义模板', fields: ['问题', '答案', '备注'] },
          ],
        };
      },
    },
  };
});

import Settings from '../../plugins/Settings';
import { ANKI_DECK_KEY, getSelectedAnkiDeck, setSelectedAnkiDeck } from './deckSelection';
import { ANKI_MODEL_KEY, getSelectedAnkiModel, setSelectedAnkiModel } from './modelSelection';
import { mapFieldsToModel, findModelByName, inferCardTypeFromModelName } from './resolveModel';

beforeEach(() => {
  // 清空 mock Settings 存储
  const s = Settings as unknown as { deleteSetting: (o: { key: string }) => Promise<void> };
  void s.deleteSetting({ key: ANKI_DECK_KEY });
  void s.deleteSetting({ key: ANKI_MODEL_KEY });
});

describe('deckSelection', () => {
  it('默认无已选牌组（null）', async () => {
    await expect(getSelectedAnkiDeck()).resolves.toBeNull();
  });

  it('set 后可按名读取', async () => {
    await setSelectedAnkiDeck('MyDeck');
    await expect(getSelectedAnkiDeck()).resolves.toBe('MyDeck');
  });

  it('set null 清除选择', async () => {
    await setSelectedAnkiDeck('A');
    await setSelectedAnkiDeck(null);
    await expect(getSelectedAnkiDeck()).resolves.toBeNull();
  });
});

describe('modelSelection', () => {
  it('默认无已选模型（null）', async () => {
    await expect(getSelectedAnkiModel()).resolves.toBeNull();
  });

  it('set 后可按名读取', async () => {
    await setSelectedAnkiModel('自定义模板');
    await expect(getSelectedAnkiModel()).resolves.toBe('自定义模板');
  });
});

describe('mapFieldsToModel', () => {
  it('无模型时回退 canonical 字段', () => {
    const out = mapFieldsToModel(null, { Front: 'Q', Back: 'A' }, { front: 'Q', back: 'A' });
    expect(out).toEqual({ Front: 'Q', Back: 'A' });
  });

  it('按模型字段名启发式映射（question→front / answer→back）', () => {
    const model = { id: 2, name: '自定义模板', fields: ['Question', 'Answer', '备注'] };
    const out = mapFieldsToModel(
      model,
      { Front: 'Q', Back: 'A', Text: 'Q', Extra: 'A' },
      { front: 'Q', back: 'A' }
    );
    expect(out['Question']).toBe('Q');
    expect(out['Answer']).toBe('A');
    // 备注命中 extra/备注 桶 → back
    expect(out['备注']).toBe('A');
  });

  it('移除 canonical 中模型不存在的字段', () => {
    const model = { id: 2, name: '自定义模板', fields: ['Question'] };
    const out = mapFieldsToModel(model, { Front: 'Q', Back: 'A' }, { front: 'Q', back: 'A' });
    expect(out).not.toHaveProperty('Back');
    expect(out['Question']).toBe('Q');
  });
});

describe('inferCardTypeFromModelName', () => {
  it('模型名含 cloze → cloze', () => {
    expect(inferCardTypeFromModelName('Cloze')).toBe('cloze');
    expect(inferCardTypeFromModelName('My Cloze Model')).toBe('cloze');
  });
  it('模型名含 image/occlusion → image_occlusion', () => {
    expect(inferCardTypeFromModelName('Image Occlusion')).toBe('image_occlusion');
    expect(inferCardTypeFromModelName('Image Occlusion Enhanced')).toBe('image_occlusion');
  });
  it('其余（含未选/空）→ basic', () => {
    expect(inferCardTypeFromModelName('Basic')).toBe('basic');
    expect(inferCardTypeFromModelName('')).toBe('basic');
    expect(inferCardTypeFromModelName(null)).toBe('basic');
    expect(inferCardTypeFromModelName(undefined)).toBe('basic');
  });
  it('大小写不敏感', () => {
    expect(inferCardTypeFromModelName('basic')).toBe('basic');
    expect(inferCardTypeFromModelName('CLOZE')).toBe('cloze');
  });
});

describe('findModelByName', () => {
  it('按名找到真实模型', async () => {
    const m = await findModelByName('Basic');
    expect(m?.name).toBe('Basic');
  });

  it('找不到时返回 null', async () => {
    await expect(findModelByName('不存在的模型')).resolves.toBeNull();
  });
});
