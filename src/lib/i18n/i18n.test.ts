/**
 * i18n 语言包一致性测试
 *
 * 确保 en / zh / ja 三个语言包拥有完全相同的扁平 key 集合（值可不同，键不可缺失/多余），
 * 避免切语言后出现漏译（key 缺失会 fallback 到 en，多余则永不使用）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import en from './locales/en';
import zh from './locales/zh';
import ja from './locales/ja';

/** 递归展开嵌套对象为扁平 key 集合（点号连接） */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const locales = { en, zh, ja };

describe('i18n 语言包一致性', () => {
  it('三个语言包包含全部命名空间', () => {
    for (const [name, data] of Object.entries(locales)) {
      for (const ns of ['common', 'app', 'inbox', 'entry', 'settings', 'create', 'editor', 'template', 'confirmGate', 'actions']) {
        expect(data, `${name} 缺命名空间 ${ns}`).toHaveProperty(ns);
      }
    }
  });

  it('三语言扁平 key 集合完全一致', () => {
    const flat: Record<string, string[]> = {};
    for (const [name, data] of Object.entries(locales)) {
      flat[name] = flattenKeys(data as Record<string, unknown>).sort();
    }

    const enSet = new Set(flat.en);
    for (const name of ['zh', 'ja']) {
      const otherSet = new Set(flat[name]);
      const missing = flat.en.filter((k) => !otherSet.has(k));
      const extra = flat[name].filter((k) => !enSet.has(k));
      expect(missing, `${name} 缺失的 key: ${missing.join(', ')}`).toEqual([]);
      expect(extra, `${name} 多余的 key: ${extra.join(', ')}`).toEqual([]);
    }
  });

  it('语言包非空且有内容', () => {
    for (const [name, data] of Object.entries(locales)) {
      expect(flattenKeys(data as Record<string, unknown>).length, `${name} 为空`).toBeGreaterThan(30);
    }
  });

  it('页面 t() 调用键均存在于语言包', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const root = join(__dirname, '..', '..', '..'); // src/
    const enFlat = new Set(flattenKeys(en as Record<string, unknown>));

    const scanDirs = ['pages', 'components', 'lib/theme'];
    const seen = new Set<string>();
    for (const d of scanDirs) {
      const dir = join(root, d);
      const files = readdirRecursive(dir);
      for (const f of files) {
        if (!/\.[jt]sx?$/.test(f) || /\.test\.[jt]sx?$/.test(f)) continue;
        const src = readFileSync(f, 'utf-8');
        const re = /t\(['"]([^'"]+)['"]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          const key = m[1];
          if (seen.has(key)) continue;
          seen.add(key);
          expect(enFlat.has(key), `t() 键 "${key}" 未定义于语言包（文件: ${f}）`).toBe(true);
        }
      }
    }
  });
});

/** 递归列出目录下所有文件 */
function readdirRecursive(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readdirRecursive(full));
    else out.push(full);
  }
  return out;
}
