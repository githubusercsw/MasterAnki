/**
 * useDeckSelector hook 单测
 *
 * 验证：初始牌组名回退、真实牌组加载、showDeckSelector 派生（仅取决于 API 可读 + 未切自定义，
 * 不耦合 deckName 匹配结果）、选真实牌组持久化、切自定义、onPickDeck 回调。
 * mock Settings（deckSelection 依赖）与 AnkiDroid.getDecks（可注入空列表）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { store, decksResponse } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const decksResponse = { decks: [] as Array<{ id: number; name: string }> };
  return { store, decksResponse };
});

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

vi.mock('../../plugins/AnkiDroid', () => ({
  __esModule: true,
  default: {
    async getDecks() {
      return { decks: decksResponse.decks };
    },
  },
}));

import { useDeckSelector } from './useDeckSelector';
import { ANKI_DECK_KEY } from './deckSelection';

beforeEach(() => {
  store.clear();
  decksResponse.decks = [
    { id: 1, name: 'Default' },
    { id: 2, name: 'MasterAnki' },
  ];
});

describe('useDeckSelector', () => {
  it('初始无已选牌组时回退默认 MasterAnki', async () => {
    const { result } = renderHook(() => useDeckSelector());
    await waitFor(() => expect(result.current.decksLoading).toBe(false));
    expect(result.current.deckName).toBe('MasterAnki');
  });

  it('初始有已选牌组时以其为 deckName', async () => {
    store.set(ANKI_DECK_KEY, 'Default');
    const { result } = renderHook(() => useDeckSelector());
    await waitFor(() => expect(result.current.deckName).toBe('Default'));
    expect(result.current.decksLoading).toBe(false);
  });

  it('initialDeckName 优先于已选牌组', async () => {
    store.set(ANKI_DECK_KEY, 'Default');
    const { result } = renderHook(() => useDeckSelector({ initialDeckName: 'EntryDeck' }));
    await waitFor(() => expect(result.current.deckName).toBe('EntryDeck'));
  });

  it('加载真实牌组并派生 showDeckSelector（匹配时为 true）', async () => {
    store.set(ANKI_DECK_KEY, 'Default');
    const { result } = renderHook(() => useDeckSelector());
    await waitFor(() => expect(result.current.decksLoading).toBe(false));
    expect(result.current.realDecks.length).toBe(2);
    expect(result.current.showDeckSelector).toBe(true);
  });

  it('deckName 不在真实列表时仍展示选择器（API 可读即渲染，不耦合匹配结果）', async () => {
    store.set(ANKI_DECK_KEY, '不在列表');
    const { result } = renderHook(() => useDeckSelector());
    await waitFor(() => expect(result.current.decksLoading).toBe(false));
    expect(result.current.realDecks.length).toBeGreaterThan(0);
    expect(result.current.showDeckSelector).toBe(true);
  });

  it('API 无可读牌组（realDecks 为空）时回退自由输入（showDeckSelector=false）', async () => {
    decksResponse.decks = [];
    const { result } = renderHook(() => useDeckSelector());
    await waitFor(() => expect(result.current.decksLoading).toBe(false));
    expect(result.current.realDecks.length).toBe(0);
    expect(result.current.showDeckSelector).toBe(false);
  });

  it('pickRealDeck 持久化所选牌组并置 showDeckSelector=true', async () => {
    const onPick = vi.fn();
    const { result } = renderHook(() => useDeckSelector({ onPickDeck: onPick }));
    await waitFor(() => expect(result.current.decksLoading).toBe(false));
    await act(async () => {
      await result.current.pickRealDeck('MasterAnki');
    });
    expect(store.get(ANKI_DECK_KEY)).toBe('MasterAnki');
    expect(onPick).toHaveBeenCalledWith('MasterAnki');
    expect(result.current.deckName).toBe('MasterAnki');
    expect(result.current.showDeckSelector).toBe(true);
  });

  it('pickCustomDeck 切到自定义输入（showDeckSelector=false）', async () => {
    store.set(ANKI_DECK_KEY, 'Default');
    const { result } = renderHook(() => useDeckSelector());
    await waitFor(() => expect(result.current.decksLoading).toBe(false));
    expect(result.current.showDeckSelector).toBe(true);
    await act(async () => {
      result.current.pickCustomDeck();
    });
    expect(result.current.showDeckSelector).toBe(false);
  });
});
