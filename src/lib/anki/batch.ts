/**
 * 批量执行服务（batch）
 *
 * 通用批量任务执行器：串行执行 + 失败收集，产出成功/失败清单。
 * 用于批量入库/批量删除等场景（自动化缺把关的治理：失败不静默，必出清单）。
 *
 * 与具体业务（AnkiDroid/Inbox）解耦：调用方提供任务列表即可。
 */

export interface BatchTask {
  /** 任务标识（如卡片 id） */
  id: string;
  /** 人类可读标签（如卡片 front，用于失败清单展示） */
  label: string;
  /** 执行函数（应自行 catch 内部错误并 throw） */
  run: () => Promise<void>;
}

export interface BatchFailure {
  id: string;
  label: string;
  error: string;
}

export interface BatchResult {
  succeeded: string[];
  failures: BatchFailure[];
  successCount: number;
  failureCount: number;
}

/**
 * 串行执行一批任务。
 *
 * 串行而非并发：AnkiDroid 等外部系统对并发写敏感，且串行便于稳定产出失败清单。
 *
 * @param tasks 任务列表
 * @param onProgress 每完成一个任务回调（可用于 UI 进度）
 */
export async function runBatch(
  tasks: BatchTask[],
  onProgress?: (done: number, total: number) => void
): Promise<BatchResult> {
  const succeeded: string[] = [];
  const failures: BatchFailure[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    try {
      await t.run();
      succeeded.push(t.id);
    } catch (e) {
      failures.push({
        id: t.id,
        label: t.label,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    onProgress?.(i + 1, tasks.length);
  }

  return {
    succeeded,
    failures,
    successCount: succeeded.length,
    failureCount: failures.length,
  };
}

/** 批量任务是否全部成功 */
export function allSucceeded(result: BatchResult): boolean {
  return result.failureCount === 0;
}
