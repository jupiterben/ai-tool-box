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

const REQUEST_TIMEOUT_MS = 180_000;

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

你的任务是综合各平台回答，给出**带明确结果的结论**——用户读完就知道「答案是什么、结果会怎样」，而不是只看到分析过程或空泛建议。

请生成一份精炼、可执行的 Markdown 汇总，要求：

## 输出原则
1. 使用中文，语气直接、务实
2. **禁止**使用 Markdown 表格；用段落、有序/无序列表表达
3. **禁止**大段复述各平台原文；每处引用控制在 1～2 句以内
4. **禁止**只写「可以考虑」「建议尝试」而无定论；必须给出综合后的最终判断
5. 结论里要包含**可感知的结果**：具体答案、选型、参数、代码要点、数值、是否可行、预期效果等
6. 各平台原文会单独展示，汇总里不要重复粘贴全文
7. 只输出 Markdown 正文，不要包裹在代码块中

## 必须包含的章节（按此顺序）

### 最终结论
**本节最重要。** 用 3～5 句话直接给出问题的答案，并明确写出**结果是什么**，例如：
- 技术问题 → 最终方案/配置/代码写法是什么，运行后会得到什么
- 选型问题 → 最终推荐选哪个，理由一句话
- 是否可行 → 明确「可以/不可以/有条件可以」，条件是什么
- 若平台有分歧 → 给出你的综合判断及**采纳后的预期结果**

不要只描述「各平台怎么说」，要写「综合后答案是什么、结果怎样」。

### 关键结果摘要
用 bullet 列出 3～8 条**带结果的事实**，每条必须是具体产出，例如：
- 「推荐使用 Redis，QPS 可支撑 1 万+」
- 「正确写法是 \`xxx\`，否则会报 Y 错误」
- 「预算 5000 元内最优选是 A 型号」
禁止写「平台 A 认为…平台 B 认为…」这类无结论的对比句。

### 推荐做法
编号列出可执行步骤；**每一步末尾标注预期结果**（做完这一步会得到什么）。包含关键参数、注意事项、适用场景。

### 平台观点精炼
按平台逐一总结（每个平台 2～3 句），只保留：
- 该平台给出的**具体答案/结果**是什么
- 与其他平台不同的关键结论（如有）
不要抄原文，不要写过程性描述。

### 分歧与待确认项（如有）
仅在有明显冲突或信息缺口时写此节：说明不确定点，并给出**验证后应得到的明确结果**（例如「运行 X 命令，若输出 Y 则选方案 A」）。

## 用户问题

${payload.question || '（未提供明确问题，请根据回复内容推断）'}

## 各平台回复

${responseBlocks}`;
}

function buildChatRequestBody(settings: LlmSettings, prompt: string): Record<string, unknown> {
  const messages = [
    {
      role: 'system',
      content:
        '你是专业的 AI 回复分析助手。综合多个 AI 的回答后，必须给出带明确结果的结论：答案是什么、选型是什么、预期效果是什么。禁止空泛分析和无定论的对比，禁止表格。用户需要的是「结果」，不是「各平台说了什么」。',
    },
    { role: 'user', content: prompt },
  ];

  if (settings.provider === 'minimax') {
    return {
      model: settings.model,
      temperature: settings.temperature,
      max_completion_tokens: settings.maxTokens,
      thinking: { type: 'disabled' },
      messages,
    };
  }

  return {
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    messages,
  };
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

    const response = await postJson(
      apiUrl,
      apiKey,
      buildChatRequestBody(settings, prompt)
    );

    const markdown = extractAssistantContent(response);
    return { success: true, markdown };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'LLM 汇总失败',
    };
  }
}
