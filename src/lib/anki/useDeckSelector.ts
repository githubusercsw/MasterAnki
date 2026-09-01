/**
 * useDeckSelector — Anki 牌组选择器状态机（跨页面共享）
 *
 * 消除 EntryDetail / ManualCreate / TemplateSelect 三处重复实现：
 * - 加载 AnkiDroid 真实牌组列表（getDecks）
 * - 管理 deckName / useCustomDeck / showDeckSelector 派生判断（展示选择器仅取决于 API 可读 + 未切自定义）
 * - 选择真实牌组（持久化 + 可选回调）/ 切到新建自定义
 *
 * 兼容性：不改变任何插件接口；行为与三页现状完全一致。
 */

import { useEffect, useState } from 'react';
import AnkiDroid, { type AnkiDeckInfo } from '../../plugins/AnkiDroid';
import { getSelectedAnkiDeck, setSelectedAnkiDeck } from './deckSelection';

export interface UseDeckSelectorOptions {
  /** 初始牌组名（如条目已保存的 deckName；提供则优先于已选牌组） */
  initialDeckName?: string;
  /** 选择真实牌组后的额外副作用（如 EntryDetail 同步 Inbox.updateDeckName） */
  onPickDeck?: (name: string) => void | Promise<void>;
}

export interface DeckSelector {
  /** 当前牌组名（受控值） */
  deckName: string;
  /** 更新牌组名（自由输入时用） */
  setDeckName: (name: string) => void;
  /** 真实牌组列表 */
  realDecks: AnkiDeckInfo[];
  /** 牌组列表加载中 */
  decksLoading: boolean;
  /** 是否展示选择器（API 可读取真实牌组且未切自定义） */
  showDeckSelector: boolean;
  /** 选择真实牌组：持久化 + 可选回调 */
  pickRealDeck: (name: string) => Promise<void>;
  /** 切到新建自定义牌组（自由输入） */
  pickCustomDeck: () => void;
}

export function useDeckSelector(opts: UseDeckSelectorOptions = {}): DeckSelector {
  const { initialDeckName, onPickDeck } = opts;
  const [deckName, setDeckName] = useState(initialDeckName ?? 'MasterAnki');
  const [realDecks, setRealDecks] = useState<AnkiDeckInfo[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [useCustomDeck, setUseCustomDeck] = useState(false);

  // 挂载：加载真实牌组 + 初始牌组名（initialDeckName 优先，否则已选牌组）
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setDecksLoading(true);
      try {
        const res = await AnkiDroid.getDecks();
        if (!cancelled && res.decks && res.decks.length > 0) {
          setRealDecks(res.decks);
        }
      } catch {
        // API 不可用 → 保持自由输入
      } finally {
        if (!cancelled) setDecksLoading(false);
      }
      if (!cancelled && !initialDeckName) {
        const saved = await getSelectedAnkiDeck();
        if (!cancelled && saved) setDeckName(saved);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 响应 initialDeckName 变化（EntryDetail 异步加载条目后覆盖，未自定义时生效）
  useEffect(() => {
    if (initialDeckName && !useCustomDeck) {
      setDeckName(initialDeckName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeckName]);

  // 派生判断：仅取决于 API 可读取真实牌组 + 未切自定义；
  // 不再耦合 deckName 与真实列表的匹配结果，保证「新建牌组」入口独立可见，
  // 与卡片类型选择器（数据可获取即渲染下拉）行为一致。
  const showDeckSelector = !useCustomDeck && realDecks.length > 0;

  const pickRealDeck = async (name: string) => {
    await setSelectedAnkiDeck(name);
    setDeckName(name);
    setUseCustomDeck(false);
    await onPickDeck?.(name);
  };

  const pickCustomDeck = () => {
    setUseCustomDeck(true);
  };

  return {
    deckName,
    setDeckName,
    realDecks,
    decksLoading,
    showDeckSelector,
    pickRealDeck,
    pickCustomDeck,
  };
}
