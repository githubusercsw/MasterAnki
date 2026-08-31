/**
 * Web 降级实现与模型映射单测
 *
 * 覆盖：
 * - Log 的 Web 降级（localStorage 模拟落库，追加/查询/清空）
 * - AnkiDroid 的 Web 降级（不可用判定、原生写操作抛错）
 * - MODEL_KEYS 映射 AnkiDroid 内置模型名
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { webLog } from './logWeb';
import { webAnkiDroid } from './ankidroidWeb';
import { MODEL_KEYS, MODELS } from '../../lib/anki/ankidroid';

describe('Log Web 降级', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('append 后可按时间倒序查询（最新在前）', async () => {
    await webLog.append({ level: 'info', tag: 'test', message: 'first' });
    await webLog.append({ level: 'error', tag: 'test', message: 'second', stack: 'at x' });

    const { logs } = await webLog.getRecent({ limit: 10 });
    expect(logs).toHaveLength(2);
    // 倒序：最后写入的在最前
    expect(logs[0].message).toBe('second');
    expect(logs[0].stack).toBe('at x');
    expect(logs[1].message).toBe('first');
    expect(logs[1].stack).toBeNull();
  });

  it('limit 生效', async () => {
    for (let i = 0; i < 5; i++) {
      await webLog.append({ level: 'info', tag: 't', message: `m${i}` });
    }
    const { logs } = await webLog.getRecent({ limit: 2 });
    expect(logs).toHaveLength(2);
  });

  it('clear 清空全部', async () => {
    await webLog.append({ level: 'info', tag: 't', message: 'x' });
    await webLog.clear();
    const { logs } = await webLog.getRecent();
    expect(logs).toHaveLength(0);
  });
});

describe('AnkiDroid Web 降级', () => {
  it('checkDependency 返回不可用（用于 UI 门禁）', async () => {
    const res = await webAnkiDroid.checkDependency({ depId: 'ankidroid.ioenhanced' });
    expect(res.available).toBe(false);
  });

  it('原生写操作在 Web 抛明确错误', async () => {
    await expect(webAnkiDroid.createDeck({ name: 'x' })).rejects.toThrow(/仅在 Android 原生环境/);
    await expect(webAnkiDroid.addNote({ note: {} as never })).rejects.toThrow(
      /仅在 Android 原生环境/
    );
    await expect(webAnkiDroid.updateNote({ noteId: 1, note: {} as never })).rejects.toThrow(
      /仅在 Android 原生环境/
    );
    await expect(
      webAnkiDroid.ensureModel({ modelKey: 'x', fields: [], templates: [] })
    ).rejects.toThrow(/仅在 Android 原生环境/);
  });
});

describe('MODEL_KEYS 映射 AnkiDroid 内置模型', () => {
  it('basic → Basic、cloze → Cloze、image_occlusion → Image Occlusion', () => {
    expect(MODEL_KEYS.basic).toBe('Basic');
    expect(MODEL_KEYS.cloze).toBe('Cloze');
    expect(MODEL_KEYS.image_occlusion).toBe('Image Occlusion');
  });

  it('MODELS 字段与内置模型一致', () => {
    expect(MODELS.basic.fields).toEqual(['Front', 'Back']);
    expect(MODELS.cloze.fields).toEqual(['Text', 'Extra']);
    // Image Occlusion 字段与 AnkiDroid IO Enhanced 模型一致
    expect(MODELS.image_occlusion.fields).toContain('Image');
  });
});
