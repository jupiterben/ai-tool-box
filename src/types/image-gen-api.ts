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

/** Bing 生图选项（toolId=bing-create 时生效） */
export interface BingImageOptions {
  /** 模型：gpt4o（默认）| dalle | maiimage2 */
  model?: 'gpt4o' | 'dalle' | 'maiimage2';
  /** 纵横比：1:1（默认）| 7:4 | 4:7 | 3:2 | 2:3 */
  aspectRatio?: '1:1' | '7:4' | '4:7' | '3:2' | '2:3';
  /** 底层 mdl 参数（数值或模型名，一般无需手动指定） */
  mdl?: number | string;
  /** 底层 ar 参数（数值，一般无需手动指定） */
  ar?: number;
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
  /** 期望生成张数（默认 1，最大 8）；同一 webview 对话内连续生成，不新开对话 */
  count?: number;
  /** Bing 专用选项 */
  bing?: BingImageOptions;
}

export interface GenImageResult {
  success: boolean;
  toolId?: string;
  prompt?: string;
  images?: ExtractedImage[];
  error?: string;
  /** 实际生图路径：web-api=StreamGenerate，webview-dom=页面模拟 */
  via?: 'web-api' | 'webview-dom';
  /** via=webview-dom 时，记录 Web API 失败原因 */
  apiError?: string;
}

export interface EnsureImageWebviewRequest {
  requestId: string;
  toolId: string;
  threadId?: string;
}

export interface EnsureImageWebviewResult {
  requestId: string;
  success: boolean;
  webContentsId?: number;
  error?: string;
}
