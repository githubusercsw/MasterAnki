/**
 * 内容去重（dedup）
 *
 * - 内容哈希：对提取文本计算 SHA-256，同源检测
 * - 语义相似度（可选）：通过 embedding 计算近似重复
 *
 * 纯函数实现，便于单元测试。
 */

/** 使用 Web Crypto 计算 SHA-256 */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 生成归一化内容（去空白/去标点大小写归一，供哈希与相似度使用） */
export function normalizeContent(text: string): string {
  return text
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[，。！？、；：""''（）《》.,!?;:'"()\]{}]/g, '')
    .toLowerCase()
    .trim();
}

/** 基于内容哈希的同源检测 */
export async function computeSourceHash(content: string): Promise<string> {
  return sha256(normalizeContent(content));
}

/** 两段文本是否完全重复（归一化后相等） */
export async function isExactDuplicate(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(normalizeContent(a)), sha256(normalizeContent(b))]);
  return ha === hb;
}

/**
 * 简单字符级相似度（0-1）。
 * 作为语义相似度的轻量降级方案：Jaccard 字符二元组。
 * 语义 embedding 版本后续可替换此实现（接口不变）。
 */
export function similarity(a: string, b: string): number {
  const na = normalizeContent(a);
  const nb = normalizeContent(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const union = ga.size + gb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 判断是否近似重复（超过阈值） */
export function isNearDuplicate(a: string, b: string, threshold = 0.9): boolean {
  return similarity(a, b) >= threshold;
}

export interface DedupResult {
  /** 是否与已有来源重复 */
  isDuplicate: boolean;
  /** 是否近似重复（语义层） */
  isNearDuplicate: boolean;
  /** 命中的已有来源哈希 */
  matchedHash?: string;
}
