import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import {
  LLM_PROVIDER_PRESETS,
  type LlmSettings,
  type SummarizeResponsesPayload,
  type SummarizeResponsesResult,
} from '../src/types/llm-settings';
import { getLlmApiKey, loadLlmSettings } from './llmManager';

const REQUEST_TIMEOUT_MS = 60_000;

function resolveApiUrl(settings: LlmSettings): string {
  if (settings.provider === 'custom') {
    const base = settings.baseUrl?.trim();
    if (!base) {
      throw new Error('自定义提供商需要填写 API Base URL');
    }
    return base.endsWith('/chat/completions')
      ? base
      : `${base.replace(/\/$/, '')}/chat/completions`;
  }
  return LLM_PROVIDER_PRESETS[settings.provider].baseUrl;
}

function buildSummarizePrompt(payload: SummarizeResponsesPayload): string {
  const responseBlocks = payload.responses
    .map(
      (item, index) =>
        `### 平台 ${index + 1}：${item.toolName}\n\n${item.content}`
    )
    .join('\n\n---\n\n');

  return `你是一个 AI 回复汇总助手。用户向多个 AI 平台提出了同一个问题，以下是各平台的回复。

请生成一份结构清晰、可直接阅读的 Markdown 汇总文档，要求：
1. 使用中文
2. 包含「问题」「综合摘要」「共识与差异」「各平台要点对比」「推荐结论」等章节
3. 综合摘要要提炼各平台的共同观点与分歧点
4. 在文末附上「各平台原文」章节，保留各平台完整回复（可适当排版）
5. 只输出 Markdown，不要包裹在代码块中

## 用户问题

${payload.question || '（未提供明确问题，请根据回复内容推断）'}

## 各平台回复

${responseBlocks}`;
}

function extractAssistantContent(data: unknown): string {
  const parsed = data as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (parsed.error?.message) {
    throw new Error(parsed.error.message);
  }

  const content = parsed.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('LLM 返回内容为空');
  }
  return content;
}

function postJson(urlString: string, apiKey: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body);
    const isHttps = url.protocol === 'https:';
    const requestFn = isHttps ? httpsRequest : httpRequest;

    const req = requestFn(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as unknown;
            if (res.statusCode && res.statusCode >= 400) {
              const err = parsed as { error?: { message?: string } };
              reject(new Error(err.error?.message || `HTTP ${res.statusCode}`));
              return;
            }
            resolve(parsed);
          } catch {
            reject(new Error(`解析 LLM 响应失败: ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('LLM 请求超时'));
    });

    req.write(payload);
    req.end();
  });
}

export async function summarizeResponses(
  payload: SummarizeResponsesPayload
): Promise<SummarizeResponsesResult> {
  const settings = await loadLlmSettings();

  if (!settings.enabled) {
    return { success: false, error: 'LLM 汇总未启用，请在「LLM 设置」中开启' };
  }

  const apiKey = await getLlmApiKey();
  if (!apiKey) {
    return { success: false, error: '未配置 API Key，请在「LLM 设置」中填写' };
  }

  if (!payload.responses.length) {
    return { success: false, error: '没有可汇总的回复内容' };
  }

  try {
    const apiUrl = resolveApiUrl(settings);
    const prompt = buildSummarizePrompt(payload);

    const response = await postJson(apiUrl, apiKey, {
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages: [
        {
          role: 'system',
          content:
            '你是专业的 AI 回复分析助手，擅长对比多个 AI 的回答并生成结构化的 Markdown 汇总。',
        },
        { role: 'user', content: prompt },
      ],
    });

    const markdown = extractAssistantContent(response);
    return { success: true, markdown };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'LLM 汇总失败',
    };
  }
}
