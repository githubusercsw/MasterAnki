/**
 * 显式生命周期管理
 *
 * 替代原 MasterFlasher 的 checkAutoRemove 隐式判断：
 * - 删除条目必须显式触发（用户确认），不因"全部卡片已入库"自动删除
 * - 卡片入库失败置 error 状态，永不静默
 * - 提供可撤销的删除（soft delete → 彻底删除）
 */

import type { Flashcard, InboxEntry } from './types';

export type EntryLifecycleState = 'active' | 'locked' | 'archived';

export interface LifecycleDecision {
  action: 'keep' | 'archive' | 'flag';
  reason: string;
}

/**
 * 判断条目生命周期状态。
 * 显式规则，不做隐式自动删除。
 */
export function decideEntryLifecycle(entry: InboxEntry, cards: Flashcard[]): LifecycleDecision {
  // 显式锁定（卡片已生成待审阅）
  if (entry.isLocked) {
    return { action: 'keep', reason: 'locked' };
  }

  const hasError = cards.some((c) => c.status === 'error');
  if (hasError) {
    // 有失败卡片：标记而非删除，交由用户处理
    return { action: 'flag', reason: 'some_cards_failed' };
  }

  const allAdded = cards.length > 0 && cards.every((c) => c.status === 'added');
  if (allAdded) {
    // 全部入库：给出归档建议，但等待显式确认
    return { action: 'archive', reason: 'all_cards_added' };
  }

  return { action: 'keep', reason: 'pending' };
}

/** 是否需要提示用户处理（flag/archive 均需用户关注） */
export function requiresUserAttention(decision: LifecycleDecision): boolean {
  return decision.action !== 'keep';
}
