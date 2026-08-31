/**
 * LogService 单例
 *
 * 统一日志入口：
 * - 捕获全局异常（window error / unhandledrejection）与 console 调用
 * - 业务侧通过 debug/info/warn/error 显式写日志
 * - 落库走 Log 插件（原生 Room / Web localStorage）
 * - 提供查看、导出、清空（设置页 UI 使用）
 *
 * 应用启动时调用 init() 安装全局捕获；之后可直接通过单例写日志。
 */

import Log, { type LogLevel, type LogRecord } from '../../plugins/Log';

/** 单条待写日志的内部表示（时间戳在写入层补充） */
interface PendingLog {
  level: LogLevel;
  tag: string;
  message: string;
  stack?: string;
}

export class LogService {
  private static _instance: LogService | null = null;

  private initialized = false;
  private origConsole: {
    log: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  } | null = null;

  private constructor() {}

  /** 获取单例（首次访问无需 ctx，日志不依赖业务上下文） */
  static getInstance(): LogService {
    if (!LogService._instance) {
      LogService._instance = new LogService();
    }
    return LogService._instance;
  }

  /** 安装全局捕获（幂等）。仅在 app 入口调用一次。 */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 保留原始 console，避免递归
    this.origConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    // 全局未捕获异常
    window.addEventListener('error', (e) => {
      const err = e.error ?? e.message;
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      void this.error('global', msg, stack);
    });

    // 未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason;
      const msg =
        reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
      const stack = reason instanceof Error ? reason.stack : undefined;
      void this.error('global', msg, stack);
    });

    // 拦截 console（仅 info/warn/error；log 太多太噪，不落库）
    console.info = (...args: unknown[]) => {
      this.origConsole?.info(...args);
      void this.write({ level: 'info', tag: 'console', message: formatArgs(args) });
    };
    console.warn = (...args: unknown[]) => {
      this.origConsole?.warn(...args);
      void this.write({ level: 'warn', tag: 'console', message: formatArgs(args) });
    };
    console.error = (...args: unknown[]) => {
      this.origConsole?.error(...args);
      void this.write({ level: 'error', tag: 'console', message: formatArgs(args) });
    };
  }

  // ─── 显式写入 ───────────────────────────────────────────────

  debug(tag: string, message: string): void {
    void this.write({ level: 'debug', tag, message });
  }

  info(tag: string, message: string): void {
    void this.write({ level: 'info', tag, message });
  }

  warn(tag: string, message: string): void {
    void this.write({ level: 'warn', tag, message });
  }

  error(tag: string, message: string, stack?: string): void {
    void this.write({ level: 'error', tag, message, stack });
  }

  /** 业务侧把 Error 对象包装成日志（提取 message + stack） */
  errorFrom(tag: string, err: unknown): void {
    if (err instanceof Error) {
      this.error(tag, err.message, err.stack);
    } else {
      this.error(tag, String(err ?? 'Unknown error'));
    }
  }

  // ─── 读取 / 导出 / 清空 ────────────────────────────────────

  /** 取最近 N 条（默认 100） */
  async getRecent(limit = 100): Promise<LogRecord[]> {
    try {
      const res = await Log.getRecent({ limit });
      return res.logs ?? [];
    } catch (e) {
      this.origConsole?.warn('LogService.getRecent failed:', e);
      return [];
    }
  }

  /** 清空全部日志 */
  async clear(): Promise<void> {
    try {
      await Log.clear();
    } catch (e) {
      this.origConsole?.warn('LogService.clear failed:', e);
    }
  }

  /** 导出为纯文本（设置页"导出"按钮用） */
  async exportText(limit = 500): Promise<string> {
    const logs = await this.getRecent(limit);
    if (logs.length === 0) return '(no logs)';
    const lines = logs.map((l) => {
      const t = new Date(l.createdAt).toISOString();
      const stack = l.stack ? `\n${indent(l.stack, '    ')}` : '';
      return `[${t}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}${stack}`;
    });
    // 返回倒序（最新在前）
    return lines.join('\n');
  }

  // ─── 内部 ──────────────────────────────────────────────────

  private async write(p: PendingLog): Promise<void> {
    try {
      await Log.append({
        level: p.level,
        tag: p.tag,
        message: p.message.slice(0, 2000),
        stack: p.stack ? p.stack.slice(0, 4000) : undefined,
      });
    } catch (e) {
      // 落库失败时回退到原始 console，避免静默
      this.origConsole?.warn('LogService.write failed:', e);
    }
  }
}

// ─── 工具 ────────────────────────────────────────────────────

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}${a.stack ? '\n' + a.stack : ''}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
}
