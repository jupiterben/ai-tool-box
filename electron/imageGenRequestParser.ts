import type { IncomingMessage } from 'node:http';
import type { GenImageRequest, BingImageOptions } from '../src/types/image-gen-api.js';
import type { ReferenceImage } from '../src/types/reference-image.js';
import { REFERENCE_IMAGE_MAX_BYTES } from '../src/types/reference-image.js';

const MAX_BODY_BYTES = 20 * 1024 * 1024;

interface ParsedMultipart {
  fields: Record<string, string>;
  file?: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  };
}

function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseContentType(req: IncomingMessage): { type: string; boundary?: string } {
  const raw = req.headers['content-type'] || '';
  const parts = raw.split(';').map((part) => part.trim());
  const type = parts[0]?.toLowerCase() || '';
  const boundaryPart = parts.find((part) => part.startsWith('boundary='));
  const boundary = boundaryPart?.slice('boundary='.length).replace(/^"|"$/g, '');
  return { type, boundary };
}

function parseMultipartForm(body: Buffer, boundary: string): ParsedMultipart {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: ParsedMultipart['file'];

  let start = body.indexOf(delimiter);
  while (start >= 0) {
    const next = body.indexOf(delimiter, start + delimiter.length);
    const part = body.subarray(start + delimiter.length, next >= 0 ? next : body.length);
    start = next;

    if (!part.length || part.equals(Buffer.from('--')) || part.subarray(0, 2).equals(Buffer.from('--'))) {
      continue;
    }

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;

    const headerText = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + 4);
    const contentBody = content.endsWith('\r\n')
      ? content.subarray(0, content.length - 2)
      : content;

    const disposition = headerText.match(/content-disposition:[^\r\n]*/i)?.[0] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const filenameMatch = disposition.match(/filename="([^"]*)"/i);
    const fieldName = nameMatch?.[1];
    if (!fieldName) continue;

    const contentType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();

    if (filenameMatch) {
      const filename = filenameMatch[1] || `${fieldName}.png`;
      if (!file || ['referenceImage', 'file', 'image'].includes(fieldName)) {
        file = {
          name: filename,
          mimeType: contentType || 'application/octet-stream',
          buffer: Buffer.from(contentBody),
        };
      }
      continue;
    }

    fields[fieldName] = contentBody.toString('utf8');
  }

  return { fields, file };
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  const base64 = dataUrl.slice(comma + 1);
  return Math.floor((base64.length * 3) / 4);
}

export function normalizeReferenceImageInput(input: unknown): ReferenceImage | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const value = input as Record<string, unknown>;
  const dataUrl = typeof value.dataUrl === 'string' ? value.dataUrl : '';
  const mimeType =
    typeof value.mimeType === 'string'
      ? value.mimeType
      : typeof value.contentType === 'string'
        ? value.contentType
        : '';
  const name = typeof value.name === 'string' ? value.name : 'reference.png';
  const base64 = typeof value.base64 === 'string' ? value.base64 : '';

  let resolvedDataUrl = dataUrl;
  let resolvedMimeType = mimeType;

  if (!resolvedDataUrl && base64) {
    resolvedMimeType = resolvedMimeType || 'image/png';
    resolvedDataUrl = base64.startsWith('data:')
      ? base64
      : `data:${resolvedMimeType};base64,${base64}`;
  }

  if (!resolvedDataUrl || !resolvedMimeType) {
    return null;
  }

  if (!resolvedDataUrl.startsWith('data:')) {
    resolvedDataUrl = `data:${resolvedMimeType};base64,${resolvedDataUrl}`;
  }

  if (estimateDataUrlBytes(resolvedDataUrl) > REFERENCE_IMAGE_MAX_BYTES) {
    throw new Error(`参考图不能超过 ${Math.floor(REFERENCE_IMAGE_MAX_BYTES / 1024 / 1024)}MB`);
  }

  return {
    name,
    mimeType: resolvedMimeType,
    dataUrl: resolvedDataUrl,
  };
}

function parseBingOptions(input: unknown): BingImageOptions | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const value = input as Record<string, unknown>;
  const bing: BingImageOptions = {};

  if (typeof value.model === 'string') {
    bing.model = value.model as BingImageOptions['model'];
  }
  if (typeof value.aspectRatio === 'string') {
    bing.aspectRatio = value.aspectRatio as BingImageOptions['aspectRatio'];
  }
  if (typeof value.mdl === 'number' || typeof value.mdl === 'string') {
    bing.mdl = value.mdl;
  }
  if (typeof value.ar === 'number' && Number.isFinite(value.ar)) {
    bing.ar = value.ar;
  }

  return Object.keys(bing).length ? bing : undefined;
}

function buildRequestFromParts(parts: {
  prompt?: string;
  toolId?: string;
  timeoutMs?: number;
  count?: number;
  referenceImage?: ReferenceImage | null;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  referenceImageName?: string;
  bing?: BingImageOptions;
}): GenImageRequest {
  const prompt = parts.prompt?.trim() || '';
  let referenceImage = parts.referenceImage ?? null;

  if (!referenceImage && parts.referenceImageBase64) {
    referenceImage = normalizeReferenceImageInput({
      base64: parts.referenceImageBase64,
      mimeType: parts.referenceImageMimeType || 'image/png',
      name: parts.referenceImageName || 'reference.png',
    });
  }

  if (!prompt && !referenceImage) {
    throw new Error('prompt 与 referenceImage 至少提供一个');
  }

  return {
    prompt,
    toolId: parts.toolId,
    timeoutMs: parts.timeoutMs,
    count: parts.count,
    referenceImage,
    bing: parts.bing,
  };
}

function parseJsonRequest(body: string): GenImageRequest {
  const parsed = JSON.parse(body) as Record<string, unknown>;

  const referenceImage = parsed.referenceImage
    ? normalizeReferenceImageInput(parsed.referenceImage)
    : null;

  const timeoutMs =
    typeof parsed.timeoutMs === 'number' && Number.isFinite(parsed.timeoutMs)
      ? parsed.timeoutMs
      : undefined;

  const count =
    typeof parsed.count === 'number' && Number.isFinite(parsed.count)
      ? parsed.count
      : undefined;

  return buildRequestFromParts({
    prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
    toolId: typeof parsed.toolId === 'string' ? parsed.toolId : undefined,
    timeoutMs,
    count,
    referenceImage,
    bing: parseBingOptions(parsed.bing),
    referenceImageBase64:
      typeof parsed.referenceImageBase64 === 'string' ? parsed.referenceImageBase64 : undefined,
    referenceImageMimeType:
      typeof parsed.referenceImageMimeType === 'string' ? parsed.referenceImageMimeType : undefined,
    referenceImageName:
      typeof parsed.referenceImageName === 'string' ? parsed.referenceImageName : undefined,
  });
}

function parseMultipartRequest(body: Buffer, boundary: string): GenImageRequest {
  const parsed = parseMultipartForm(body, boundary);
  const file = parsed.file;

  let referenceImage: ReferenceImage | null = null;
  if (file) {
    if (file.buffer.length > REFERENCE_IMAGE_MAX_BYTES) {
      throw new Error(`参考图不能超过 ${Math.floor(REFERENCE_IMAGE_MAX_BYTES / 1024 / 1024)}MB`);
    }
    const mimeType =
      file.mimeType.startsWith('image/') ? file.mimeType : 'image/png';
    referenceImage = {
      name: file.name,
      mimeType,
      dataUrl: bufferToDataUrl(file.buffer, mimeType),
    };
  }

  const timeoutRaw = parsed.fields.timeoutMs;
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : undefined;
  const countRaw = parsed.fields.count;
  const count = countRaw ? Number(countRaw) : undefined;
  let bing: BingImageOptions | undefined;
  if (parsed.fields.bing) {
    try {
      bing = parseBingOptions(JSON.parse(parsed.fields.bing));
    } catch {
      throw new Error('bing 字段必须是合法 JSON');
    }
  } else if (parsed.fields.bingModel || parsed.fields.bingAspectRatio) {
    bing = parseBingOptions({
      model: parsed.fields.bingModel,
      aspectRatio: parsed.fields.bingAspectRatio,
    });
  }

  return buildRequestFromParts({
    prompt: parsed.fields.prompt,
    toolId: parsed.fields.toolId,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    count: Number.isFinite(count) ? count : undefined,
    referenceImage,
    bing,
  });
}

export async function parseGenImageRequest(req: IncomingMessage): Promise<GenImageRequest> {
  const { type, boundary } = parseContentType(req);
  const body = await readBodyBuffer(req);

  if (type.includes('multipart/form-data')) {
    if (!boundary) {
      throw new Error('multipart 请求缺少 boundary');
    }
    return parseMultipartRequest(body, boundary);
  }

  return parseJsonRequest(body.toString('utf8'));
}
