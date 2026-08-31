/**
 * SpeechRecognition Capacitor 插件接口
 *
 * 原生语音转文字（Android SpeechRecognizer）。
 */

import { registerPlugin } from '@capacitor/core';

export interface SpeechRecognitionPlugin {
  available(): Promise<{ available: boolean }>;
  start(options?: { language?: string; maxResults?: number }): Promise<void>;
  stop(): Promise<void>;
  /** 实时/最终识别结果监听由原生事件驱动 */
}

const SpeechRecognition = registerPlugin<SpeechRecognitionPlugin>('SpeechRecognition');

export default SpeechRecognition;
