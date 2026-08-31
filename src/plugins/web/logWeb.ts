/**
 * Log Web 降级实现
 *
 * Web（浏览器）环境用 localStorage 模拟日志落库，行为与原生 Room 一致。
 * 仅用于开发调试；真机走原生 LogPlugin。
 */

import type { LogPlugin, LogRecord, LogLevel } from '../Log';

const STORAGE_KEY = 'ma:logs';

const ALLOWED: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function readAll(): LogRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LogRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(records: LogRecord[]): void {
  // 只保留最近 500 条，防止 localStorage 溢出
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 500)));
}

export const webLog: LogPlugin = {
  async append({ level, tag, message, stack }) {
    const rec: LogRecord = {
      id: Date.now(),
      level: ALLOWED.includes(level) ? level : 'info',
      tag,
      message,
      stack: stack ?? null,
      createdAt: Date.now(),
    };
    writeAll([rec, ...readAll()]);
  },

  async getRecent({ limit = 100 } = {}) {
    return { logs: readAll().slice(0, Math.max(1, limit)) };
  },

  async clear() {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
