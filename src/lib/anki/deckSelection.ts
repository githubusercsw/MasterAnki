/**
 * Anki 牌组选择状态
 *
 * 通过 Settings 插件持久化"用户选用的 AnkiDroid 牌组名"，
 * 供入库链路（addNote）使用真实牌组，而非默认自由文本。
 *
 * 未选择时返回 null → 调用方回退默认牌组名（MasterAnki）。
 */

import Settings from '../../plugins/Settings';

export const ANKI_DECK_KEY = 'masteranki:ankiDeck';

/** 读取已选牌组名（null = 未选择/使用默认牌组） */
export async function getSelectedAnkiDeck(): Promise<string | null> {
  try {
    const res = await Settings.getSetting({ key: ANKI_DECK_KEY });
    const v = res?.value;
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/** 保存所选牌组名（空字符串清除） */
export async function setSelectedAnkiDeck(name: string | null): Promise<void> {
  try {
    await Settings.setSetting({ key: ANKI_DECK_KEY, value: name ?? '' });
  } catch {
    // 静默：设置失败不影响核心流程
  }
}
