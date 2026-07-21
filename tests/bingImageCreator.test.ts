import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  generateBingImagesViaWebviewFetch,
  resolveBingApiParams,
} from '../electron/bingImageCreator.ts';

const originalConsoleLog = console.log;

before(() => {
  console.log = () => undefined;
});

after(() => {
  console.log = originalConsoleLog;
});

interface MockResponseOptions {
  status?: number;
  contentType?: string;
  url?: string;
}

interface MockWebContentsOptions {
  pageFetch: (url: string, init?: RequestInit) => Promise<Response>;
  imageFetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

function response(body: BodyInit | null, options: MockResponseOptions = {}): Response {
  const result = new Response(body, {
    status: options.status ?? 200,
    headers: options.contentType ? { 'content-type': options.contentType } : undefined,
  });
  Object.defineProperty(result, 'url', { value: options.url ?? '', configurable: true });
  return result;
}

function evaluateWebviewScript(
  script: string,
  fetchImpl: MockWebContentsOptions['pageFetch']
): Promise<unknown> {
  const expression = script.trim().replace(/;$/, '');
  const evaluate = new Function('fetch', `return (${expression})`) as (
    fetch: MockWebContentsOptions['pageFetch']
  ) => Promise<unknown>;
  return evaluate(fetchImpl);
}

function createMockWebContents(options: MockWebContentsOptions) {
  const imageFetch = options.imageFetch ?? (async () =>
    response(new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' }));

  return {
    executeJavaScript: (script: string) => evaluateWebviewScript(script, options.pageFetch),
    session: { fetch: imageFetch },
  };
}

function createTaskResponse(requestId = 'request/with+reserved=chars'): Response {
  return response('', {
    contentType: 'text/html; charset=utf-8',
    url: `https://www.bing.com/images/create/generated/1-ABCDEF0123456789?id=${encodeURIComponent(requestId)}`,
  });
}

describe('resolveBingApiParams', () => {
  it('resolves defaults used by the Bing API', () => {
    assert.deepEqual(resolveBingApiParams({}), {
      mdl: 'gpt4o',
      ar: 1,
      model: 'gpt4o',
      aspectRatio: '1:1',
    });
  });

  it('maps every supported aspect ratio to its API value', () => {
    assert.equal(resolveBingApiParams({ model: 'dalle', aspectRatio: '7:4' }).ar, 2);
    assert.equal(resolveBingApiParams({ model: 'dalle', aspectRatio: '4:7' }).ar, 3);
    assert.equal(resolveBingApiParams({ model: 'gpt4o', aspectRatio: '3:2' }).ar, 4);
    assert.equal(resolveBingApiParams({ model: 'gpt4o', aspectRatio: '2:3' }).ar, 5);
  });

  it('honors low-level mdl/ar overrides', () => {
    assert.deepEqual(resolveBingApiParams({ mdl: 99, ar: 42 }), {
      mdl: 99,
      ar: 42,
      model: 'gpt4o',
      aspectRatio: '1:1',
    });
  });

  it('rejects unknown models, aspect ratios, and unsupported combinations', () => {
    assert.throws(
      () => resolveBingApiParams({ model: 'unknown' as never }),
      /不支持的 Bing 模型/
    );
    assert.throws(
      () => resolveBingApiParams({ aspectRatio: '16:9' as never }),
      /不支持的 Bing 纵横比/
    );
    assert.throws(
      () => resolveBingApiParams({ model: 'dalle', aspectRatio: '3:2' }),
      /模型 dalle 不支持纵横比 3:2/
    );
  });
});

describe('generateBingImagesViaWebviewFetch', () => {
  it('rejects an empty prompt before touching the webview', async () => {
    let executed = false;
    const wc = {
      executeJavaScript: async () => {
        executed = true;
      },
      session: { fetch: async () => response(null) },
    };

    const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: '   ' });

    assert.deepEqual(result, { success: false, error: 'prompt 不能为空' });
    assert.equal(executed, false);
  });

  it('returns parameter validation errors before sending a request', async () => {
    const wc = createMockWebContents({
      pageFetch: async () => assert.fail('fetch must not run for invalid options'),
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, {
      prompt: 'test',
      model: 'dalle',
      aspectRatio: '3:2',
    });

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /模型 dalle 不支持纵横比 3:2/);
  });

  it('uses the new creator and polling endpoints and preserves a UTF-8 prompt', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const requestId = 'request/with+reserved=chars';
    const imageUrl = 'https://th.bing.com/th/id/OIG1.apiTest?w=256&h=256&c=7&r=0&o=5&pid=ImgGn';
    let downloadedUrl = '';

    const wc = createMockWebContents({
      pageFetch: async (url, init) => {
        calls.push({ url, init });
        if (calls.length === 1) return createTaskResponse(requestId);
        return response(JSON.stringify({ records: [{ mediaItems: [{ src: imageUrl }] }] }), {
          contentType: 'application/json',
        });
      },
      imageFetch: async (url) => {
        downloadedUrl = url;
        return response(new Uint8Array([1, 2, 3]), { contentType: 'image/webp; charset=binary' });
      },
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, {
      prompt: '一颗红苹果 & white background',
      model: 'gpt4o',
      aspectRatio: '3:2',
      timeoutMs: 5_000,
    });

    assert.equal(result.success, true);
    assert.equal(result.images?.length, 1);
    assert.equal(result.images?.[0]?.mimeType, 'image/webp');
    assert.equal(result.images?.[0]?.base64, Buffer.from([1, 2, 3]).toString('base64'));
    assert.match(calls[0]!.url, /^https:\/\/www\.bing\.com\/images\/create\/ai-image-generator\?/);
    assert.match(calls[0]!.url, /q=%E4%B8%80%E9%A2%97%E7%BA%A2%E8%8B%B9%E6%9E%9C%20%26%20white%20background/);
    assert.match(calls[0]!.url, /mdl=gpt4o/);
    assert.match(calls[0]!.url, /ar=4/);
    assert.equal(calls[0]!.init?.method, 'POST');
    assert.match(String(calls[0]!.init?.body), /^q=%E4%B8%80%E9%A2%97/);
    assert.match(calls[1]!.url, /\/ai-image-generator\/async\/results\/request%2Fwith%2Breserved%3Dchars\?/);

    const upgraded = new URL(downloadedUrl);
    assert.equal(upgraded.searchParams.get('w'), '1024');
    assert.equal(upgraded.searchParams.get('h'), '1024');
    assert.equal(upgraded.searchParams.has('c'), false);
    assert.equal(upgraded.searchParams.has('r'), false);
    assert.equal(upgraded.searchParams.has('o'), false);
  });

  it('extracts an immediate image from the new detail result page without polling', async () => {
    let callCount = 0;
    const wc = createMockWebContents({
      pageFetch: async () => {
        callCount += 1;
        return response(
          '<aigc-media-display><img src="https://th.bing.com/th/id/OIG2.immediate?pid=ImgGn"></aigc-media-display>',
          {
            contentType: 'text/html',
            url: 'https://www.bing.com/images/create/generated/1-ABCDEF0123456789?id=immediate-id',
          }
        );
      },
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

    assert.equal(result.success, true);
    assert.equal(result.images?.length, 1);
    assert.equal(callCount, 1);
  });

  it('parses escaped URLs returned in JSON', async () => {
    let callCount = 0;
    const wc = createMockWebContents({
      pageFetch: async () => {
        callCount += 1;
        if (callCount === 1) return createTaskResponse('escaped-id');
        return response(
          '{"mediaUrl":"https:\\/\\/th.bing.com\\/th\\/id\\/OIG3.escaped?w=512\\u0026h=512\\u0026pid=ImgGn"}',
          { contentType: 'application/json' }
        );
      },
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

    assert.equal(result.success, true);
    assert.equal(result.images?.length, 1);
  });

  it('normalizes protocol-relative image URLs', async () => {
    let downloadedUrl = '';
    const wc = createMockWebContents({
      pageFetch: async () => response(
        '<img src="//th.bing.com/th/id/OIG1.relative?pid=ImgGn">',
        {
          contentType: 'text/html',
          url: 'https://www.bing.com/images/create/generated/1-ABCDEF0123456789?id=relative-id',
        }
      ),
      imageFetch: async (url) => {
        downloadedUrl = url;
        return response(new Uint8Array([1]), { contentType: 'image/png' });
      },
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

    assert.equal(result.success, true);
    assert.equal(downloadedUrl, 'https://th.bing.com/th/id/OIG1.relative?pid=ImgGn');
  });

  it('downloads at most four images from a Bing result', async () => {
    let pageCalls = 0;
    let downloadCalls = 0;
    const images = Array.from(
      { length: 5 },
      (_, index) => `<img src="https://th.bing.com/th/id/OIG${index + 1}.limit?pid=ImgGn">`
    ).join('');
    const wc = createMockWebContents({
      pageFetch: async () => {
        pageCalls += 1;
        return pageCalls === 1 ? createTaskResponse('limit-id') : response(images);
      },
      imageFetch: async () => {
        downloadCalls += 1;
        return response(new Uint8Array([downloadCalls]), { contentType: 'image/png' });
      },
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

    assert.equal(result.success, true);
    assert.equal(result.images?.length, 4);
    assert.equal(downloadCalls, 4);
  });

  it('does not mistake public feed records for the newly-created task', async () => {
    const wc = createMockWebContents({
      pageFetch: async () => response(
        '<script>{"requestId":"historical-feed-item"}</script>',
        {
          contentType: 'text/html',
          url: 'https://www.bing.com/images/create/ai-image-generator?q=test',
        }
      ),
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /未返回生成任务/);
  });

  it('surfaces polling HTTP, message, and structured Bing errors', async (context) => {
    const cases = [
      {
        name: 'HTTP error',
        poll: response('server error', { status: 503 }),
        expected: /Bing 轮询失败: HTTP 503/,
      },
      {
        name: 'message error',
        poll: response('{"errorMessage":"blocked prompt"}', { contentType: 'application/json' }),
        expected: /Bing 错误: blocked prompt/,
      },
      {
        name: 'structured error',
        poll: response('{"status":3,"errorType":2}', { contentType: 'application/json' }),
        expected: /Bing 生成失败: status=3, errorType=2/,
      },
    ];

    for (const testCase of cases) {
      await context.test(testCase.name, async () => {
        let callCount = 0;
        const wc = createMockWebContents({
          pageFetch: async () => {
            callCount += 1;
            return callCount === 1 ? createTaskResponse(testCase.name) : testCase.poll;
          },
        });

        const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

        assert.equal(result.success, false);
        assert.match(result.error ?? '', testCase.expected);
      });
    }
  });

  it('returns a timeout when a task has no poll opportunity', async () => {
    const wc = createMockWebContents({ pageFetch: async () => createTaskResponse('timeout-id') });

    const result = await generateBingImagesViaWebviewFetch(wc as never, {
      prompt: 'test',
      timeoutMs: 0,
    });

    assert.deepEqual(result, { success: false, error: '生图超时，Bing 未返回结果' });
  });

  it('returns a download error when every generated image fails to download', async () => {
    let callCount = 0;
    const wc = createMockWebContents({
      pageFetch: async () => {
        callCount += 1;
        if (callCount === 1) return createTaskResponse('download-failure');
        return response('<img src="https://th.bing.com/th/id/OIG4.failed?pid=ImgGn">');
      },
      imageFetch: async () => response('not found', { status: 404, contentType: 'text/plain' }),
    });

    const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

    assert.deepEqual(result, { success: false, error: '图片下载失败' });
  });

  it('rejects non-image, empty, and thrown image downloads', async (context) => {
    const cases: Array<{
      name: string;
      imageFetch: MockWebContentsOptions['imageFetch'];
    }> = [
      {
        name: 'non-image content type',
        imageFetch: async () => response('html', { contentType: 'text/html' }),
      },
      {
        name: 'empty image body',
        imageFetch: async () => response(new Uint8Array(), { contentType: 'image/png' }),
      },
      {
        name: 'network exception',
        imageFetch: async () => {
          throw new Error('network unavailable');
        },
      },
    ];

    for (const testCase of cases) {
      await context.test(testCase.name, async () => {
        let callCount = 0;
        const wc = createMockWebContents({
          pageFetch: async () => {
            callCount += 1;
            if (callCount === 1) return createTaskResponse(testCase.name);
            return response('<img src="https://th.bing.com/th/id/OIG1.bad-download?pid=ImgGn">');
          },
          imageFetch: testCase.imageFetch,
        });

        const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

        assert.deepEqual(result, { success: false, error: '图片下载失败' });
      });
    }
  });

  it('returns webview execution errors instead of throwing', async (context) => {
    const cases = [
      { name: 'Error object', thrown: new Error('renderer crashed'), expected: 'renderer crashed' },
      { name: 'non-Error value', thrown: 'renderer crashed', expected: 'Bing webview fetch 失败' },
    ];

    for (const testCase of cases) {
      await context.test(testCase.name, async () => {
        const wc = {
          executeJavaScript: async () => {
            throw testCase.thrown;
          },
          session: { fetch: async () => response(null) },
        };

        const result = await generateBingImagesViaWebviewFetch(wc as never, { prompt: 'test' });

        assert.deepEqual(result, { success: false, error: testCase.expected });
      });
    }
  });
});
