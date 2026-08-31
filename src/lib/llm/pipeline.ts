/**
 * 三步生成管线
 *
 * 事实提取 → 事实评分 → 卡片生成
 * 管线只依赖 LLMProvider 接口，按 capabilities 分支，与具体 Provider 解耦。
 */

import type { LLMProvider } from './provider';
import type { FactsResponse, FlashcardsResponse, Flashcard, Fact } from '../anki/types';
import { validateFactsResponse, validateFlashcardsResponse } from '../validation/validateJson';
import type { CardType } from '../anki/types';

/** 事实提取的最大文本块大小（与上下文长度平衡） */
const CHUNK_SIZE = 8000;
/** 卡片生成每批最大事实数，防止输出截断 */
const MAX_FACTS_PER_BATCH = 25;
/** 评分每批最大事实数 */
const MAX_FACTS_PER_SCORE_BATCH = 50;
/** 评分阈值（0-18，centrality 2x） */
const SCORE_THRESHOLD = 9;

/** 各步骤的 JSON schema（通用结构，Provider 按能力适配） */
const FACTS_SCHEMA = {
  type: 'object',
  properties: {
    sourceTitle: { type: 'string' },
    facts: {
      type: 'array',
      items: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] },
    },
  },
  required: ['facts'],
};

const SCORE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      score_total: { type: 'number' },
    },
    required: ['id', 'score_total'],
  },
};

const CARDS_SCHEMA = {
  type: 'object',
  properties: {
    deck: { type: 'string' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          front: { type: 'string' },
          back: { type: 'string' },
          cloze: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['front', 'back'],
      },
    },
  },
  required: ['cards'],
};

/** 文本分块（按句子边界） */
function chunkText(text: string, chunkSize = CHUNK_SIZE): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let current = '';
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+(\s|$)/g) ?? [text];
  for (const s of sentences) {
    if ((current + s).length > chunkSize) {
      if (current) chunks.push(current);
      current = s;
    } else {
      current += s;
    }
  }
  if (current) chunks.push(current);
  if (chunks.length === 0 && text.length > 0) chunks.push(text);
  return chunks;
}

/** 分块工具 */
function batch<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** 提取 JSON（容忍 markdown 代码块包裹） */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // 去掉可能的 ```json ... ``` 包裹
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // 尝试找到第一个 { 或 [ 到最后一个 } 或 ]
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf(']'), candidate.lastIndexOf('}'));
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Failed to parse JSON from LLM response');
  }
}

export interface GenerationPromptSet {
  factExtractionPrompt: string;
  factScoringPrompt: string;
  flashcardCreationPrompt: string;
}

/** 默认提示词（保持与系统约束分离，可被用户覆盖） */
export const DEFAULT_PROMPTS: GenerationPromptSet = {
  factExtractionPrompt:
    'You are a careful analyst. Extract atomic, non-obvious facts from the text. ' +
    'Each fact must be self-contained, verifiable, and useful for learning. ' +
    'Return a JSON object with a "facts" array of {fact} objects.',
  factScoringPrompt:
    'Score each fact from 0-3 on: centrality, non_obviousness, leverage, testability, transfer. ' +
    'score_total = centrality*2 + others. Return a JSON array of {id, scores, score_total}.',
  flashcardCreationPrompt:
    'Create Anki flashcards from the given facts. Prefer "basic" cards (front/back). ' +
    'Return a JSON object with "deck" and "cards" array of {type, front, back, tags}.',
};

/**
 * 三步生成管线
 */
export class LLMPipeline {
  constructor(
    private readonly provider: LLMProvider,
    private readonly prompts: GenerationPromptSet = DEFAULT_PROMPTS
  ) {}

  /** 步骤 1：事实提取（大文本分块并发） */
  async generateFacts(text: string, title?: string): Promise<FactsResponse> {
    const chunks = chunkText(text);
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const prompt = `${this.prompts.factExtractionPrompt}

Context/Title: ${title ?? 'Unknown'}
Text:
${chunk}`;
        const res = await this.provider.generateContent(prompt, {
          schema: FACTS_SCHEMA,
        });
        if (res.finishReason !== 'stop' || !res.text) return [];
        const json = extractJson(res.text);
        const validated = validateFactsResponse(json);
        return validated.facts;
      })
    );
    const allFacts = results.flat();
    // 去重并分配 id
    const seen = new Set<string>();
    const uniqueFacts: Fact[] = [];
    for (const f of allFacts) {
      const key = f.fact.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFacts.push({ id: crypto.randomUUID(), fact: f.fact });
      }
    }
    return { sourceTitle: title, facts: uniqueFacts };
  }

  /** 步骤 2：事实评分与过滤（按能力：schema 或降级） */
  async scoreFacts(facts: Fact[]): Promise<Fact[]> {
    if (facts.length === 0) return [];
    const mode = this.provider.capabilities.structuredOutput;
    // 仅 schema 模式才做严格评分过滤；其他模式降级为保留全部
    if (mode !== 'schema') {
      return facts;
    }

    const batches = batch(facts, MAX_FACTS_PER_SCORE_BATCH);
    const passed: Fact[] = [];

    for (const b of batches) {
      const prompt = `${this.prompts.factScoringPrompt}

Facts to score:
${JSON.stringify(
  b.map((f) => ({ id: f.id, fact: f.fact })),
  null,
  2
)}`;
      const res = await this.provider.generateContent(prompt, { schema: SCORE_SCHEMA });
      if (res.finishReason !== 'stop' || !res.text) continue;

      let scores: Array<{ id: string; score_total: number }> = [];
      try {
        const json = extractJson(res.text);
        scores = Array.isArray(json)
          ? json.filter(
              (s): s is { id: string; score_total: number } =>
                !!s && typeof s.id === 'string' && typeof s.score_total === 'number'
            )
          : [];
      } catch {
        continue;
      }

      const byId = new Map(scores.map((s) => [s.id, s.score_total]));
      for (const f of b) {
        const total = byId.get(f.id);
        if (total === undefined || total > SCORE_THRESHOLD) {
          passed.push(f);
        }
      }
    }
    return passed;
  }

  /** 步骤 3：卡片生成（分批防截断） */
  async generateFlashcards(
    facts: Fact[],
    cardType: CardType = 'basic'
  ): Promise<FlashcardsResponse> {
    if (facts.length === 0) {
      return { deck: 'MasterAnki', cards: [] };
    }
    const batches = batch(facts, MAX_FACTS_PER_BATCH);
    const allCards: Flashcard[] = [];

    for (let i = 0; i < batches.length; i++) {
      const prompt = `${this.prompts.flashcardCreationPrompt}

Card type: ${cardType}
Concepts:
${JSON.stringify(batches[i], null, 2)}`;
      const res = await this.provider.generateContent(prompt, {
        schema: CARDS_SCHEMA,
      });
      if (res.finishReason !== 'stop' || !res.text) continue;
      try {
        const json = extractJson(res.text);
        const validated = validateFlashcardsResponse(json);
        allCards.push(...validated.cards);
      } catch {
        // 单个批次失败不拖垮整体
      }
      if (i < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return { deck: 'MasterAnki', cards: allCards };
  }

  /** 完整三步流程 */
  async run(
    text: string,
    title?: string,
    cardType: CardType = 'basic'
  ): Promise<FlashcardsResponse> {
    const factsResp = await this.generateFacts(text, title);
    const scored = await this.scoreFacts(factsResp.facts);
    return this.generateFlashcards(scored, cardType);
  }
}
