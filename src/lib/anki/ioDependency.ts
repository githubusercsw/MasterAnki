/**
 * IO 插件依赖检测（把关机制）
 *
 * Image Occlusion 模板依赖 AnkiDroid 的 Image Occlusion Enhanced 插件。
 * 未安装时在 UI 层禁用该模板选项，而非运行时报错。
 */

import AnkiDroid from '../../plugins/AnkiDroid';

export const IO_PLUGIN_ID = 'ankidroid.ioenhanced';

/**
 * 检测 AnkiDroid IO Enhanced 插件是否可用。
 * Web 环境原生插件不可用时返回 false（禁用模板），不抛错。
 */
export async function isImageOcclusionAvailable(): Promise<boolean> {
  try {
    const res = await AnkiDroid.checkDependency({ depId: IO_PLUGIN_ID });
    return res.available ?? false;
  } catch {
    // 原生插件不可用（Web 开发环境）→ 视为未安装，UI 层禁用
    return false;
  }
}
