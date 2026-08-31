/**
 * CameraOCR Capacitor 插件接口
 *
 * 相机拍摄 + 裁剪 + 设备端 OCR（ML Kit）。
 */

import { registerPlugin } from '@capacitor/core';

export interface CameraOCRPlugin {
  startCapture(): Promise<{ text?: string; imageDataUrl?: string; cancelled?: boolean }>;
}

const CameraOCR = registerPlugin<CameraOCRPlugin>('CameraOCR');

export default CameraOCR;
