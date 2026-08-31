/**
 * Anki 模型（模板）选择状态
 *
 * 通过 Settings 插件持久化"用户选用的 AnkiDroid 真实模型名"，
 * 供入库链路（addNote）使用真实模板，而非写死的内置 Basic/Cloze/IO。
 *
 * 未选择时返回 null → 调用方回退内置模型映射。
 */

import Settings from '../../plugins/Settings';

export const ANKI_MODEL_KEY = 'masteranki:ankiModel';

/** 读取已选模型名（null = 未选择/使用内置默认） */
export async function getSelectedAnkiModel(): Promise<string | null> {
  try {
    const res = await Settings.getSetting({ key: ANKI_MODEL_KEY });
    const v = res?.value;
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/** 保存所选模型名（空字符串清除） */
export async function setSelectedAnkiModel(name: string | null): Promise<void> {
  try {
    await Settings.setSetting({ key: ANKI_MODEL_KEY, value: name ?? '' });
  } catch {
    // 静默：设置失败不影响核心流程
  }
}
