import { AITool, ToolRegion, ToolRegionGroup } from '../types/ai-tool';

export const TOOL_REGION_LABELS: Record<ToolRegion, string> = {
  domestic: '国内',
  international: '国外',
};

export const TOOL_REGION_ORDER: ToolRegion[] = ['domestic', 'international'];

export const DEFAULT_TOOLS: AITool[] = [
  // 国内
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    region: 'domestic',
  },
  {
    id: 'qianwen',
    name: '千问',
    url: 'https://www.qianwen.com/chat',
    region: 'domestic',
  },
  {
    id: 'minimax',
    name: 'MiniMax Agent',
    url: 'https://agent.minimaxi.com/',
    region: 'domestic',
  },
  {
    id: 'chatglm',
    name: '智谱清言',
    url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh',
    region: 'domestic',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://www.kimi.com/zh',
    region: 'domestic',
  },
  {
    id: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    region: 'domestic',
  },
  {
    id: 'mimo',
    name: 'MiMo Studio',
    url: 'https://aistudio.xiaomimimo.com/#/c',
    region: 'domestic',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    url: 'https://yuanbao.tencent.com/chat/',
    region: 'domestic',
  },
  // 国外
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    region: 'international',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/',
    region: 'international',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    region: 'international',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    region: 'international',
  },
  {
    id: 'meta',
    name: 'Meta AI',
    url: 'https://www.meta.ai/',
    region: 'international',
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com/',
    region: 'international',
  },
  {
    id: 'copilot',
    name: 'Copilot',
    url: 'https://copilot.microsoft.com/',
    region: 'international',
  },
];

/** 首次安装时默认关闭的网站，可在「网站管理」设置中启用 */
export const DEFAULT_DISABLED_TOOL_IDS = ['meta', 'mimo'];

export function groupToolsByRegion(tools: AITool[]): ToolRegionGroup[] {
  return TOOL_REGION_ORDER.map((region) => ({
    region,
    label: TOOL_REGION_LABELS[region],
    tools: tools.filter((tool) => tool.region === region),
  })).filter((group) => group.tools.length > 0);
}
