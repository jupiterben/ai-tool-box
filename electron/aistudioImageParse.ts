export const AISTUDIO_TOOL_ID = 'aistudio-image';
/** Free-tier Gemini image model in AI Studio chat playground (not Imagen paid). */
export const AISTUDIO_DEFAULT_MODEL = 'gemini-2.5-flash-image';
export const AISTUDIO_CHAT_BASE_URL = 'https://aistudio.google.com/prompts/new_chat';
export const AISTUDIO_IMAGE_BASE_URL = 'https://aistudio.google.com/prompts/new_image';

export interface AiStudioParsedImage {
  url?: string;
  base64?: string;
  mimeType?: string;
}

export function isAiStudioImagenModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith('imagen-');
}

export function buildAiStudioImageUrl(model?: string): string {
  const resolved = (model || AISTUDIO_DEFAULT_MODEL).trim() || AISTUDIO_DEFAULT_MODEL;
  const base = isAiStudioImagenModel(resolved) ? AISTUDIO_IMAGE_BASE_URL : AISTUDIO_CHAT_BASE_URL;
  const url = new URL(base);
  url.searchParams.set('model', resolved);
  return url.toString();
}

export function shouldCaptureAiStudioRequest(url: string): boolean {
  const value = String(url || '').toLowerCase();
  if (!value) {
    return false;
  }

  // Billing / onboarding iframes often echo ?model=imagen-... in the query and must be ignored.
  if (
    value.includes('console.cloud.google.com') ||
    value.includes('accounts.google.com') ||
    value.includes('onboardingplatform') ||
    value.includes('authcheck') ||
    value.includes('fonts.googleapis.com') ||
    value.includes('gstatic.com') ||
    value.includes('/csi?') ||
    value.includes('play.google.com')
  ) {
    return false;
  }

  const hostMatched =
    value.includes('generativelanguage.googleapis.com') ||
    value.includes('aisandbox') ||
    value.includes('makersuite') ||
    value.includes('alkalimakersuite') ||
    (value.includes('googleapis.com') &&
      (value.includes('/v1') || value.includes('/v1beta') || value.includes(':run') || value.includes('predict')));

  if (!hostMatched) {
    return false;
  }

  return (
    value.includes(':generatecontent') ||
    value.includes(':streamgenerate') ||
    value.includes(':predict') ||
    value.includes('generateimages') ||
    value.includes('batchasync') ||
    value.includes('imagefx') ||
    value.includes(':runimagefx') ||
    value.includes(':run')
  );
}

function normalizeEscapedResponse(text: string): string {
  return String(text || '')
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\\//g, '/');
}

function cleanImageUrl(url: string): string {
  return String(url || '')
    .replace(/[\\]+$/g, '')
    .replace(/[),;\]]+$/g, '')
    .replace(/&amp;/g, '&');
}

function looksLikeImageUrl(url: string): boolean {
  const value = url.toLowerCase();
  return (
    value.includes('googleusercontent.com') ||
    value.includes('ggpht.com') ||
    value.includes('gg-dl') ||
    value.includes('generativelanguage') ||
    /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)
  );
}

function decodeLooseBase64(value: string): Buffer | null {
  const cleaned = value.replace(/\s+/g, '');
  if (cleaned.length < 64 || cleaned.length % 4 !== 0) {
    return null;
  }
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(cleaned)) {
    return null;
  }
  try {
    const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(normalized, 'base64');
    return buffer.length >= 64 ? buffer : null;
  } catch {
    return null;
  }
}

function sniffMimeType(buffer: Buffer): string {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/png';
}

/** Parse AI Studio / Imagen response text into image URLs or inline base64 payloads. */
export function extractImagesFromAiStudioText(text: string | undefined): AiStudioParsedImage[] {
  const normalized = normalizeEscapedResponse(text || '');
  const results: AiStudioParsedImage[] = [];
  const seen = new Set<string>();

  const dataUrlPattern = /data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)/g;
  let dataMatch: RegExpExecArray | null;
  while ((dataMatch = dataUrlPattern.exec(normalized)) !== null) {
    const mimeType = dataMatch[1];
    const base64 = dataMatch[2].replace(/\s+/g, '');
    const key = `data:${mimeType};${base64.slice(0, 64)}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ base64, mimeType });
    }
  }

  const namedBase64Pattern =
    /"(?:bytesBase64Encoded|data|inline_data|inlineData)"\s*:\s*"([A-Za-z0-9+/=\r\n_-]{64,})"/g;
  let namedMatch: RegExpExecArray | null;
  while ((namedMatch = namedBase64Pattern.exec(normalized)) !== null) {
    const base64 = namedMatch[1].replace(/\s+/g, '');
    const buffer = decodeLooseBase64(base64);
    if (!buffer) {
      continue;
    }
    const mimeType = sniffMimeType(buffer);
    const key = `b64:${base64.slice(0, 64)}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ base64: buffer.toString('base64'), mimeType });
    }
  }

  const urlPattern = /https?:\/\/[^"'<>\s\\]+/g;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlPattern.exec(normalized)) !== null) {
    const url = cleanImageUrl(urlMatch[0]);
    if (!looksLikeImageUrl(url) || seen.has(url)) {
      continue;
    }
    seen.add(url);
    results.push({ url });
  }

  return results;
}

export function summarizeAiStudioResponse(text: string | undefined): string {
  return normalizeEscapedResponse(text || '').replace(/\s+/g, ' ').slice(0, 500);
}
