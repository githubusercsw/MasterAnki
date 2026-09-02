/**
 * 按用户所选 AnkiDroid 真实模型解析字段映射
 *
 * 用户在模板选择页可能选了 AnkiDroid 中真实存在的模板（如自定义模型），
 * 入库时以该模型字段名为准，用启发式（字段名包含 front/back/text 等）映射
 * 卡片内容，避免硬编码 Basic/Cloze/IO 字段名导致自定义模型字段为空。
 */

import AnkiDroid, { type AnkiModelInfo } from '../../plugins/AnkiDroid';
import type { CardType } from './types';

/** 语义字段 → 卡片内容（由调用方注入） */
export interface CardFieldValues {
  front: string;
  back: string;
  clozeText?: string;
  imageUrl?: string;
}

/**
 * 给定所选模型与卡片内容，产出 { 字段名: 值 } 记录。
 * 未找到匹配字段时回退 canonical 名（Front/Back/Text/...）。
 */
export function mapFieldsToModel(
  model: AnkiModelInfo | null,
  canonical: Record<string, string>,
  values: CardFieldValues
): Record<string, string> {
  const out: Record<string, string> = { ...canonical };

  if (!model || !model.fields || model.fields.length === 0) {
    return out;
  }

  // 语义 → 候选匹配关键字（按优先级）
  const buckets: Array<{ keys: string[]; value: string }> = [
    { keys: ['front', 'question', 'q'], value: values.front },
    { keys: ['back', 'answer', 'a'], value: values.back },
    { keys: ['text'], value: values.clozeText ?? values.front },
    { keys: ['extra', '备注', '补充'], value: values.back },
    { keys: ['image', 'img', 'picture', '図'], value: values.imageUrl ?? '' },
  ];

  // 先清空 canonical 中该模型不存在的字段，再按模型字段逐个填
  const known = new Set(model.fields);
  for (const k of Object.keys(out)) {
    if (!known.has(k)) delete out[k];
  }

  for (const f of model.fields) {
    const lower = f.toLowerCase();
    for (const bucket of buckets) {
      if (bucket.keys.some((k) => lower.includes(k))) {
        out[f] = bucket.value;
        break;
      }
    }
  }
  return out;
}

/** 读取某模型在 AnkiDroid 中的定义（按名称匹配），找不到返回 null */
export async function findModelByName(name: string): Promise<AnkiModelInfo | null> {
  if (!name) return null;
  try {
    const res = await AnkiDroid.getModels();
    return (res.models ?? []).find((m) => m.name === name) ?? null;
  } catch {
    return null;
  }
}

/**
 * 由用户所选模型名推导卡片类型（生成链路的 cardType 来源）。
 *
 * 修复：生成侧原先硬编码 'basic'，导致用户选 Cloze/Image Occlusion 模板时
 * 生成与模板脱节、字段映射错位。规则：
 * - 模型名含 cloze → 'cloze'
 * - 模型名含 image/occlusion/occlu → 'image_occlusion'
 * - 其余（含未选）→ 'basic'
 */
export function inferCardTypeFromModelName(modelName: string | null | undefined): CardType {
  const name = (modelName ?? '').toLowerCase();
  if (name.includes('cloze')) return 'cloze';
  if (name.includes('image') || name.includes('occlu') || name.includes('occlusion')) {
    return 'image_occlusion';
  }
  return 'basic';
}
