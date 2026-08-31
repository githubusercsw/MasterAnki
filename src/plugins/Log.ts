/**
 * Log Capacitor 插件接口
 *
 * 运行日志（Room SQLite 落库）。前端 LogService 统一捕获 console/异常/插件调用失败后写入。
 * 设置页可查看最近日志、导出与清空。
 */

import { registerPlugin } from '@capacitor/core';
import { webLog } from './web/logWeb';

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 一条日志记录 */
export interface LogRecord {
  id: number;
  level: LogLevel;
  tag: string;
  message: string;
  stack: string | null;
  createdAt: number;
}

export interface LogPlugin {
  /** 追加一条日志：{ level, tag, message, stack? } */
  append(options: { level: LogLevel; tag: string; message: string; stack?: string }): Promise<void>;
  /** 取最近 N 条日志（默认 100）：{ limit? } → { logs } */
  getRecent(options?: { limit?: number }): Promise<{ logs: LogRecord[] }>;
  /** 清空日志 */
  clear(): Promise<void>;
}

const Log = registerPlugin<LogPlugin>('Log', { web: () => webLog });

export default Log;
