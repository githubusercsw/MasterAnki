/**
 * batch 批量执行器单元测试
 *
 * 覆盖：串行执行、失败收集、进度回调、allSucceeded
 */

import { describe, it, expect, vi } from 'vitest';
import { runBatch, allSucceeded, type BatchTask } from './batch';

describe('runBatch', () => {
  it('全部成功：产出成功清单，无失败', async () => {
    const tasks: BatchTask[] = [
      { id: '1', label: 'card 1', run: async () => {} },
      { id: '2', label: 'card 2', run: async () => {} },
    ];
    const result = await runBatch(tasks);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.succeeded).toEqual(['1', '2']);
    expect(result.failures).toEqual([]);
    expect(allSucceeded(result)).toBe(true);
  });

  it('部分失败：失败项被收集并带错误信息', async () => {
    const tasks: BatchTask[] = [
      { id: '1', label: 'card 1', run: async () => {} },
      {
        id: '2',
        label: 'card 2',
        run: async () => {
          throw new Error('AnkiDroid busy');
        },
      },
      { id: '3', label: 'card 3', run: async () => {} },
    ];
    const result = await runBatch(tasks);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.succeeded).toEqual(['1', '3']);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ id: '2', label: 'card 2', error: 'AnkiDroid busy' });
    expect(allSucceeded(result)).toBe(false);
  });

  it('失败不中断后续任务（串行继续执行）', async () => {
    const order: string[] = [];
    const tasks: BatchTask[] = [
      {
        id: '1',
        label: 'a',
        run: async () => {
          order.push('1');
          throw new Error('boom');
        },
      },
      {
        id: '2',
        label: 'b',
        run: async () => {
          order.push('2');
        },
      },
    ];
    await runBatch(tasks);
    expect(order).toEqual(['1', '2']);
  });

  it('进度回调按完成数触发', async () => {
    const onProgress = vi.fn();
    await runBatch(
      [
        { id: '1', label: 'a', run: async () => {} },
        { id: '2', label: 'b', run: async () => {} },
      ],
      onProgress
    );
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('空任务列表：空结果', async () => {
    const result = await runBatch([]);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(allSucceeded(result)).toBe(true);
  });
});
