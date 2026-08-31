/**
 * 提示词配置
 *
 * 用户可自定义事实提取与卡片生成提示词，未配置时使用默认值。
 * 通过统一配置源读写，与具体 Provider 无关。
 */

import type { ConfigSource } from '../config/configSource';

export const SETTINGS_KEYS = {
  FACT_EXTRACTION_PROMPT: 'masteranki:prompt:fact_extraction',
  FLASHCARD_CREATION_PROMPT: 'masteranki:prompt:flashcard_creation',
  FACT_SCORING_PROMPT: 'masteranki:prompt:fact_scoring',
} as const;

export const DEFAULT_FACT_EXTRACTION_PROMPT =
  'You are a careful analyst. Extract atomic, non-obvious facts from the text. ' +
  'Each fact must be self-contained, verifiable, and useful for learning. ' +
  'Return a JSON object with a "facts" array of {fact} objects.';

export const DEFAULT_FACT_SCORING_PROMPT =
  'Score each fact from 0-3 on: centrality, non_obviousness, leverage, testability, transfer. ' +
  'score_total = centrality*2 + other four. Return a JSON array of {id, scores, score_total}.';

export const DEFAULT_FLASHCARD_CREATION_PROMPT =
  'Create Anki flashcards from the given facts. Prefer "basic" cards (front/back). ' +
  'Return a JSON object with "deck" and "cards" array of {type, front, back, tags}.';

/** 系统级约束（始终追加，不可用户编辑）——与原项目策略一致 */
export const FACT_EXTRACTION_SYSTEM_CONSTRAINTS = '';

export const FLASHCARD_CREATION_SYSTEM_CONSTRAINTS =
  'Respond ONLY with valid JSON. Do not include markdown fences or extra text.';

export class PromptService {
  constructor(private readonly config: ConfigSource) {}

  async getFactExtractionPrompt(): Promise<string> {
    const v = await this.config.get(SETTINGS_KEYS.FACT_EXTRACTION_PROMPT);
    return v && v.trim() ? v : DEFAULT_FACT_EXTRACTION_PROMPT;
  }

  async setFactExtractionPrompt(prompt: string): Promise<void> {
    await this.config.set(SETTINGS_KEYS.FACT_EXTRACTION_PROMPT, prompt);
  }

  async resetFactExtractionPrompt(): Promise<void> {
    await this.config.delete(SETTINGS_KEYS.FACT_EXTRACTION_PROMPT);
  }

  async getFactScoringPrompt(): Promise<string> {
    const v = await this.config.get(SETTINGS_KEYS.FACT_SCORING_PROMPT);
    return v && v.trim() ? v : DEFAULT_FACT_SCORING_PROMPT;
  }

  async setFactScoringPrompt(prompt: string): Promise<void> {
    await this.config.set(SETTINGS_KEYS.FACT_SCORING_PROMPT, prompt);
  }

  async resetFactScoringPrompt(): Promise<void> {
    await this.config.delete(SETTINGS_KEYS.FACT_SCORING_PROMPT);
  }

  async getFlashcardCreationPrompt(): Promise<string> {
    const v = await this.config.get(SETTINGS_KEYS.FLASHCARD_CREATION_PROMPT);
    return v && v.trim() ? v : DEFAULT_FLASHCARD_CREATION_PROMPT;
  }

  async setFlashcardCreationPrompt(prompt: string): Promise<void> {
    await this.config.set(SETTINGS_KEYS.FLASHCARD_CREATION_PROMPT, prompt);
  }

  async resetFlashcardCreationPrompt(): Promise<void> {
    await this.config.delete(SETTINGS_KEYS.FLASHCARD_CREATION_PROMPT);
  }
}
