export type LlmProvider = 'openai' | 'deepseek' | 'minimax' | 'glm' | 'custom';

export interface LlmSettings {
  version: string;
  enabled: boolean;
  provider: LlmProvider;
  /** 自定义 API Base URL（provider 为 custom 时使用） */
  baseUrl?: string;
  model: string;
  /** 是否已配置 API Key（实际密钥仅存主进程） */
  hasApiKey: boolean;
  temperature: number;
  maxTokens: number;
}

export interface LlmSettingsInput {
  enabled: boolean;
  provider: LlmProvider;
  baseUrl?: string;
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
}

export interface SummarizeResponseItem {
  toolName: string;
  content: string;
}

export interface SummarizeResponsesPayload {
  question: string;
  responses: SummarizeResponseItem[];
}

export interface SummarizeResponsesResult {
  success: boolean;
  markdown?: string;
  error?: string;
}

export const LLM_SETTINGS_VERSION = '1.0.0';

export const LLM_PROVIDER_PRESETS: Record<
  Exclude<LlmProvider, 'custom'>,
  { label: string; baseUrl: string; defaultModel: string }
> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
  },
  minimax: {
    label: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1/chat/completions',
    defaultModel: 'MiniMax-M3',
  },
  glm: {
    label: 'GLM（智谱）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
  },
};

export function createDefaultLlmSettings(): LlmSettings {
  return {
    version: LLM_SETTINGS_VERSION,
    enabled: false,
    provider: 'deepseek',
    model: LLM_PROVIDER_PRESETS.deepseek.defaultModel,
    hasApiKey: false,
    temperature: 0.3,
    maxTokens: 4096,
  };
}
