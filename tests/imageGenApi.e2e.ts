import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';

const ALL_IMAGE_TOOLS = [
  'gemini-image',
  'jimeng',
  'wanxiang',
  'kling',
  'liblib',
  'yige',
  'miaohua',
  'doubao-image',
  'midjourney',
  'leonardo',
  'ideogram',
  'firefly',
  'bing-create',
  'stability',
  'recraft',
] as const;

const BING_MODEL_CASES = [
  { model: 'gpt4o', aspectRatio: '1:1' },
  { model: 'gpt4o', aspectRatio: '3:2' },
  { model: 'gpt4o', aspectRatio: '2:3' },
  { model: 'dalle', aspectRatio: '1:1' },
  { model: 'dalle', aspectRatio: '7:4' },
  { model: 'dalle', aspectRatio: '4:7' },
  { model: 'maiimage2', aspectRatio: '1:1' },
  { model: 'maiimage2', aspectRatio: '3:2' },
  { model: 'maiimage2', aspectRatio: '2:3' },
] as const;

const BASE_URL = (process.env.IMAGE_GEN_E2E_BASE_URL || 'http://127.0.0.1:3920').replace(/\/$/, '');
const API_TOKEN = process.env.IMAGE_GEN_E2E_TOKEN || '';
const TIMEOUT_MS = positiveInteger(process.env.IMAGE_GEN_E2E_TIMEOUT_MS, 90_000);
const LONG_TIMEOUT_MS = positiveInteger(process.env.IMAGE_GEN_E2E_LONG_TIMEOUT_MS, 240_000);
const RUN_ID = `${Date.now()}-${process.pid}`;
const selectedTools = parseSelectedTools(process.env.E2E_IMAGE_TOOLS || 'gemini-image,bing-create');
const primaryTool = process.env.E2E_PRIMARY_TOOL || selectedTools[0] || 'gemini-image';
const includeReference = envFlag('E2E_INCLUDE_REFERENCE');
const includeCount = envFlag('E2E_INCLUDE_COUNT');
const includeConcurrency = envFlag('E2E_INCLUDE_CONCURRENCY');
const includeBingMatrix = envFlag('E2E_BING_MATRIX');
const includeGeminiMatrix = envFlag('E2E_GEMINI_MATRIX');
const expectAuth = envFlag('E2E_EXPECT_AUTH');

let referencePng: Buffer;

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function envFlag(name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes((process.env[name] || '').toLowerCase());
}

function parseSelectedTools(raw: string): string[] {
  const values = raw === 'all' ? [...ALL_IMAGE_TOOLS] : raw.split(',').map((item) => item.trim()).filter(Boolean);
  const unknown = values.filter((item) => !ALL_IMAGE_TOOLS.includes(item as never));
  if (unknown.length) throw new Error(`Unknown E2E_IMAGE_TOOLS: ${unknown.join(', ')}`);
  return [...new Set(values)];
}

function authHeaders(token = API_TOKEN): Record<string, string> {
  return token ? { 'X-Api-Token': token } : {};
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(authHeaders())) headers.set(name, value);
  return fetch(`${BASE_URL}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(LONG_TIMEOUT_MS) });
}

async function postJson(body: unknown, path = '/api/gen_image'): Promise<{ response: Response; json: any }> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LONG_TIMEOUT_MS),
  });
  const json = await response.json();
  return { response, json };
}

function prompt(caseName: string): string {
  return `E2E ${RUN_ID} ${caseName}: a single red apple centered on a plain white background, clean product photography, no text`;
}

function assertFailure(response: Response, json: any, status: number, pattern: RegExp): void {
  assert.equal(response.status, status, JSON.stringify(json));
  assert.equal(json.success, false);
  assert.match(String(json.error || ''), pattern);
}

function assertImage(image: any): void {
  assert.equal(typeof image.base64, 'string');
  assert.ok(image.base64.length > 16, 'base64 image must not be empty');
  assert.match(String(image.mimeType), /^image\//);
  assert.equal(image.dataUrl, `data:${image.mimeType};base64,${image.base64}`);
  assert.ok(Buffer.from(image.base64, 'base64').length > 8, 'decoded image must contain bytes');
  assert.equal(typeof image.width, 'number');
  assert.equal(typeof image.height, 'number');
}

function assertSuccess(response: Response, json: any, expectedTool?: string, minimumImages = 1): void {
  assert.equal(response.status, 200, JSON.stringify({ ...json, images: json.images?.map((image: any) => ({ ...image, base64: '<omitted>', dataUrl: '<omitted>' })) }));
  assert.equal(json.success, true, JSON.stringify(json));
  if (expectedTool) assert.equal(json.toolId, expectedTool);
  assert.ok(Array.isArray(json.images));
  assert.ok(json.images.length >= minimumImages, `expected at least ${minimumImages} image(s)`);
  for (const image of json.images) assertImage(image);
}

async function postMultipart(
  fields: Record<string, string>,
  fileField?: 'referenceImage' | 'file' | 'image'
): Promise<{ response: Response; json: any }> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  if (fileField) form.set(fileField, new Blob([referencePng], { type: 'image/png' }), 'reference.png');
  const response = await apiFetch('/api/gen_image', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(LONG_TIMEOUT_MS),
  });
  return { response, json: await response.json() };
}

interface SseEvent {
  event: string;
  data: any;
}

function parseSse(text: string): SseEvent[] {
  return text.split(/\n\n+/).flatMap((block) => {
    const lines = block.split(/\r?\n/);
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
    if (!event || !data) return [];
    return [{ event, data: JSON.parse(data) }];
  });
}

before(async () => {
  referencePng = await sharp({
    create: { width: 128, height: 128, channels: 4, background: { r: 220, g: 20, b: 60, alpha: 1 } },
  }).png().toBuffer();

  let response: Response;
  try {
    response = await apiFetch('/api/health', { signal: AbortSignal.timeout(5_000) });
  } catch (error) {
    throw new Error(`Real image API is not reachable at ${BASE_URL}. Start AI Tool Box first.`, {
      cause: error,
    });
  }
  assert.equal(response.status, 200);
});

after(() => {
  console.log(`[image-gen-e2e] completed against ${BASE_URL}; tools=${selectedTools.join(',')}`);
});

describe('real HTTP contract and validation', () => {
  it('GET /api/health exposes the image API capabilities', async () => {
    const response = await apiFetch('/api/health');
    const json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.service, 'ai-tool-box-image-gen');
    for (const feature of ['prompt', 'referenceImage', 'multipart-upload', 'stream']) {
      assert.ok(json.features.includes(feature));
    }
  });

  it('OPTIONS returns CORS headers', async () => {
    const response = await apiFetch('/api/gen_image', { method: 'OPTIONS' });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  });

  it('unknown route returns 404', async () => {
    const response = await apiFetch('/api/does-not-exist');
    const json = await response.json();
    assertFailure(response, json, 404, /Not Found/);
  });

  for (const testCase of [
    { name: 'empty object', raw: '{}', error: /prompt 与 referenceImage 至少提供一个/ },
    { name: 'blank prompt', raw: '{"prompt":"   "}', error: /prompt 与 referenceImage 至少提供一个/ },
    { name: 'malformed JSON', raw: '{bad json', error: /JSON|position|property/i },
  ]) {
    it(`rejects ${testCase.name}`, async () => {
      const response = await apiFetch('/api/gen_image', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: testCase.raw,
      });
      assertFailure(response, await response.json(), 400, testCase.error);
    });
  }

  it('rejects an unsupported toolId', async () => {
    const { response, json } = await postJson({ toolId: 'not-a-real-tool', prompt: 'test' });
    assertFailure(response, json, 500, /不支持的生图工具/);
  });

  it('rejects an incomplete referenceImage object', async () => {
    const { response, json } = await postJson({ referenceImage: { name: 'bad.png', mimeType: 'image/png' } });
    assertFailure(response, json, 400, /prompt 与 referenceImage 至少提供一个/);
  });

  it('rejects a reference image larger than 10 MB', async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
    const { response, json } = await postJson({ referenceImageBase64: oversized });
    assertFailure(response, json, 400, /参考图不能超过 10MB/);
  });

  it('rejects multipart without boundary', async () => {
    const response = await apiFetch('/api/gen_image', {
      method: 'POST', headers: { 'content-type': 'multipart/form-data' }, body: 'invalid',
    });
    assertFailure(response, await response.json(), 400, /缺少 boundary/);
  });

  it('rejects invalid multipart bing JSON', async () => {
    const { response, json } = await postMultipart({ prompt: 'test', bing: '{bad' });
    assertFailure(response, json, 400, /bing 字段必须是合法 JSON/);
  });

  it('rejects invalid multipart gemini JSON', async () => {
    const { response, json } = await postMultipart({ prompt: 'test', gemini: '{bad' });
    assertFailure(response, json, 400, /gemini field must be valid JSON/);
  });

  it('stream endpoint rejects malformed JSON before opening SSE', async () => {
    const response = await apiFetch('/api/gen_image/stream', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json',
    });
    assertFailure(response, await response.json(), 400, /JSON|position|property/i);
  });

  it('rejects invalid Bing model/aspect-ratio combinations', { timeout: TIMEOUT_MS }, async () => {
    const { response, json } = await postJson({
      toolId: 'bing-create', prompt: prompt('invalid-bing-options'), timeoutMs: 15_000,
      bing: { model: 'dalle', aspectRatio: '3:2', mode: 'web-api' },
    });
    assertFailure(response, json, 500, /模型 dalle 不支持纵横比 3:2/);
  });

  it('enforces authentication when E2E_EXPECT_AUTH=1', { skip: !expectAuth }, async () => {
    const response = await fetch(`${BASE_URL}/api/gen_image`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-token': 'definitely-wrong' },
      body: JSON.stringify({ prompt: 'must not run' }),
    });
    assertFailure(response, await response.json(), 401, /Unauthorized/);
  });

  it('accepts X-Api-Token when authentication is enabled', { skip: !expectAuth }, async () => {
    assert.ok(API_TOKEN, 'IMAGE_GEN_E2E_TOKEN is required with E2E_EXPECT_AUTH=1');
    const response = await fetch(`${BASE_URL}/api/gen_image`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-token': API_TOKEN }, body: '{}',
    });
    assertFailure(response, await response.json(), 400, /prompt 与 referenceImage/);
  });

  it('accepts Authorization Bearer when authentication is enabled', { skip: !expectAuth }, async () => {
    assert.ok(API_TOKEN, 'IMAGE_GEN_E2E_TOKEN is required with E2E_EXPECT_AUTH=1');
    const response = await fetch(`${BASE_URL}/api/gen_image`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${API_TOKEN}` }, body: '{}',
    });
    assertFailure(response, await response.json(), 400, /prompt 与 referenceImage/);
  });
});

describe('real generation for every selected tool', () => {
  for (const toolId of selectedTools) {
    it(`${toolId}: JSON prompt -> real image`, { timeout: LONG_TIMEOUT_MS }, async () => {
      const { response, json } = await postJson({ toolId, prompt: prompt(`tool-${toolId}`), timeoutMs: TIMEOUT_MS });
      assertSuccess(response, json, toolId);
    });
  }

  it('omitted toolId uses the default Gemini image tool', { timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postJson({ prompt: prompt('default-tool'), timeoutMs: TIMEOUT_MS });
    assertSuccess(response, json, 'gemini-image');
  });
});

describe('real count, reference-image, multipart, and stream cases', () => {
  it('count=2 returns two real images', { skip: !includeCount, timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postJson({
      toolId: primaryTool, prompt: prompt('count-2'), count: 2, timeoutMs: LONG_TIMEOUT_MS,
    });
    assertSuccess(response, json, primaryTool, 2);
  });

  it('JSON referenceImage dataUrl', { skip: !includeReference, timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postJson({
      toolId: primaryTool, prompt: 'Turn the reference into a watercolor icon, no text', timeoutMs: TIMEOUT_MS,
      referenceImage: { name: 'reference.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${referencePng.toString('base64')}` },
    });
    assertSuccess(response, json, primaryTool);
  });

  it('JSON referenceImageBase64 shorthand', { skip: !includeReference, timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postJson({
      toolId: primaryTool, prompt: 'Create a polished 3D variation of the reference, no text', timeoutMs: TIMEOUT_MS,
      referenceImageBase64: referencePng.toString('base64'), referenceImageMimeType: 'image/png', referenceImageName: 'reference.png',
    });
    assertSuccess(response, json, primaryTool);
  });

  it('JSON referenceImage object with base64', { skip: !includeReference, timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postJson({
      toolId: primaryTool, prompt: 'Create a clean vector variation of the reference, no text', timeoutMs: TIMEOUT_MS,
      referenceImage: { name: 'reference.png', mimeType: 'image/png', base64: referencePng.toString('base64') },
    });
    assertSuccess(response, json, primaryTool);
  });

  it('reference-only JSON uses the fallback prompt', { skip: !includeReference, timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postJson({
      toolId: primaryTool, timeoutMs: TIMEOUT_MS,
      referenceImageBase64: referencePng.toString('base64'), referenceImageMimeType: 'image/png',
    });
    assertSuccess(response, json, primaryTool);
    assert.equal(json.prompt, '基于参考图生成');
  });

  for (const fileField of ['referenceImage', 'file', 'image'] as const) {
    it(`multipart file alias: ${fileField}`, { skip: !includeReference, timeout: LONG_TIMEOUT_MS }, async () => {
      const { response, json } = await postMultipart(
        { toolId: primaryTool, prompt: `Create a watercolor variation of this reference (${fileField}), no text`, timeoutMs: String(TIMEOUT_MS) },
        fileField
      );
      assertSuccess(response, json, primaryTool);
    });
  }

  it('multipart prompt without a file', { timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postMultipart({
      toolId: primaryTool, prompt: prompt('multipart-prompt-only'), timeoutMs: String(TIMEOUT_MS), count: '1',
    });
    assertSuccess(response, json, primaryTool);
  });

  it('multipart reference-only request', { skip: !includeReference, timeout: LONG_TIMEOUT_MS }, async () => {
    const { response, json } = await postMultipart(
      { toolId: primaryTool, timeoutMs: String(TIMEOUT_MS) },
      'referenceImage'
    );
    assertSuccess(response, json, primaryTool);
    assert.equal(json.prompt, '基于参考图生成');
  });

  it('SSE stream emits accepted, assigned, progress, image, and done', { timeout: LONG_TIMEOUT_MS }, async () => {
    const response = await apiFetch('/api/gen_image/stream', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toolId: primaryTool, prompt: prompt('sse-stream'), timeoutMs: TIMEOUT_MS }),
      signal: AbortSignal.timeout(LONG_TIMEOUT_MS),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /^text\/event-stream/);
    const events = parseSse(await response.text());
    const names = events.map((event) => event.event);
    for (const required of ['accepted', 'assigned', 'start', 'webview_ready', 'done']) assert.ok(names.includes(required), `missing SSE event ${required}: ${names.join(', ')}`);
    const done = events.find((event) => event.event === 'done');
    assert.ok(done);
    assert.equal(done.data.result.success, true, JSON.stringify(done.data));
    assertImage(done.data.result.images[0]);
  });

  it('SSE stream emits error and done for a real business failure', async () => {
    const response = await apiFetch('/api/gen_image/stream', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toolId: 'not-a-real-tool', prompt: 'must fail' }),
    });
    assert.equal(response.status, 200);
    const events = parseSse(await response.text());
    assert.ok(events.some((event) => event.event === 'accepted'));
    assert.ok(events.some((event) => event.event === 'assigned'));
    assert.ok(events.some((event) => event.event === 'error' && /不支持的生图工具/.test(event.data.error)));
    const done = events.find((event) => event.event === 'done');
    assert.equal(done?.data.result.success, false);
  });

  it('two real requests can use the worker pool concurrently', { skip: !includeConcurrency, timeout: LONG_TIMEOUT_MS }, async () => {
    const results = await Promise.all([
      postJson({ toolId: primaryTool, prompt: prompt('concurrent-a'), timeoutMs: TIMEOUT_MS }),
      postJson({ toolId: primaryTool, prompt: prompt('concurrent-b'), timeoutMs: TIMEOUT_MS }),
    ]);
    for (const result of results) assertSuccess(result.response, result.json, primaryTool);
  });
});

describe('real Gemini transport matrix', () => {
  for (const mode of ['auto', 'web-api', 'dom'] as const) {
    it(`transport mode=${mode}`, {
      skip: !includeGeminiMatrix || !selectedTools.includes('gemini-image'), timeout: LONG_TIMEOUT_MS,
    }, async () => {
      const { response, json } = await postJson({
        toolId: 'gemini-image', prompt: prompt(`gemini-mode-${mode}`), timeoutMs: TIMEOUT_MS,
        gemini: { mode, preferWebApi: mode !== 'dom' },
      });
      assertSuccess(response, json, 'gemini-image');
      if (mode === 'dom') assert.equal(json.via, 'webview-dom');
    });
  }

  it('multipart flattened Gemini options', {
    skip: !includeGeminiMatrix || !selectedTools.includes('gemini-image'), timeout: LONG_TIMEOUT_MS,
  }, async () => {
    const { response, json } = await postMultipart({
      toolId: 'gemini-image', prompt: prompt('gemini-multipart-flat'), timeoutMs: String(TIMEOUT_MS),
      geminiMode: 'dom', geminiPreferWebApi: 'false',
    });
    assertSuccess(response, json, 'gemini-image');
  });

  it('multipart Gemini JSON object', {
    skip: !includeGeminiMatrix || !selectedTools.includes('gemini-image'), timeout: LONG_TIMEOUT_MS,
  }, async () => {
    const { response, json } = await postMultipart({
      toolId: 'gemini-image', prompt: prompt('gemini-multipart-json'), timeoutMs: String(TIMEOUT_MS),
      gemini: JSON.stringify({ mode: 'web-api', preferWebApi: true }),
    });
    assertSuccess(response, json, 'gemini-image');
  });
});

describe('real Bing model, aspect ratio, and transport matrix', () => {
  for (const bing of BING_MODEL_CASES) {
    it(`${bing.model} ${bing.aspectRatio}`, {
      skip: !includeBingMatrix || !selectedTools.includes('bing-create'), timeout: LONG_TIMEOUT_MS,
    }, async () => {
      const { response, json } = await postJson({
        toolId: 'bing-create', prompt: prompt(`bing-${bing.model}-${bing.aspectRatio}`), timeoutMs: TIMEOUT_MS,
        bing: { ...bing, mode: 'web-api' },
      });
      assertSuccess(response, json, 'bing-create');
      assert.equal(json.via, 'web-api');
    });
  }

  for (const mode of ['auto', 'web-api', 'dom'] as const) {
    it(`transport mode=${mode}`, {
      skip: !includeBingMatrix || !selectedTools.includes('bing-create'), timeout: LONG_TIMEOUT_MS,
    }, async () => {
      const { response, json } = await postJson({
        toolId: 'bing-create', prompt: prompt(`bing-mode-${mode}`), timeoutMs: TIMEOUT_MS,
        bing: { model: 'gpt4o', aspectRatio: '1:1', mode },
      });
      assertSuccess(response, json, 'bing-create');
      if (mode === 'web-api') assert.equal(json.via, 'web-api');
      if (mode === 'dom') assert.equal(json.via, 'webview-dom');
    });
  }

  it('multipart flattened Bing options', {
    skip: !includeBingMatrix || !selectedTools.includes('bing-create'), timeout: LONG_TIMEOUT_MS,
  }, async () => {
    const { response, json } = await postMultipart({
      toolId: 'bing-create', prompt: prompt('bing-multipart-flat'), timeoutMs: String(TIMEOUT_MS),
      bingModel: 'dalle', bingAspectRatio: '7:4', bingMode: 'web-api', bingPreferWebApi: 'true',
    });
    assertSuccess(response, json, 'bing-create');
  });

  it('multipart Bing JSON object', {
    skip: !includeBingMatrix || !selectedTools.includes('bing-create'), timeout: LONG_TIMEOUT_MS,
  }, async () => {
    const { response, json } = await postMultipart({
      toolId: 'bing-create', prompt: prompt('bing-multipart-json'), timeoutMs: String(TIMEOUT_MS),
      bing: JSON.stringify({ model: 'maiimage2', aspectRatio: '2:3', mode: 'web-api' }),
    });
    assertSuccess(response, json, 'bing-create');
  });
});
