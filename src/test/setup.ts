/**
 * Vitest 测试全局 setup
 */
import '@testing-library/jest-dom';

// jsdom 环境补充 crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
  (globalThis.crypto as { randomUUID?: () => string }).randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}

// jsdom 不提供 crypto.subtle（Web Crypto），补充 Node 实现供 sha256 使用
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) {
  // Node webcrypto 的 CryptoKey 与 DOM 类型存在微小差异，断言为 unknown 规避类型冲突
  (globalThis.crypto as { subtle?: unknown }).subtle = webcrypto.subtle;
}
