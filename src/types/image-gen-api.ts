import type { ReferenceImage } from './reference-image';

export const IMAGE_GEN_API_PORT = 3920;
export const IMAGE_GEN_API_DEFAULT_TOOL_ID = 'gemini-image';

export interface ExtractedImage {
  /** 纯 base64 字符串（不含 data: 前缀） */
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  alt?: string;
  /** data URL，便于直接用于 img src */
  dataUrl?: string;
  /** 页面原始地址，仅内部用于去重 */
  originSrc?: string;
}

export interface GenImageRequest {
  toolId?: string;
  prompt?: string;
  referenceImage?: ReferenceImage | null;
  /** JSON 简写：纯 base64 字符串 */
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  referenceImageName?: string;
  timeoutMs?: number;
}

export interface GenImageResult {
  success: boolean;
  toolId?: string;
  prompt?: string;
  images?: ExtractedImage[];
  error?: string;
}

export interface EnsureImageWebviewRequest {
  requestId: string;
  toolId: string;
}

export interface EnsureImageWebviewResult {
  requestId: string;
  success: boolean;
  webContentsId?: number;
  error?: string;
}
