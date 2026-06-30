import { AITool, ToolCategory, ToolRegion, ToolRegionGroup } from '../types/ai-tool';

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  chat: '对话',
  image: '生图',
};

export const TOOL_REGION_LABELS: Record<ToolRegion, string> = {
  domestic: '国内',
  international: '国外',
};

export const TOOL_REGION_ORDER: ToolRegion[] = ['domestic', 'international'];

export const DEFAULT_CHAT_TOOLS: AITool[] = [
  // 国内
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'qianwen',
    name: '千问',
    url: 'https://www.qianwen.com/chat',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'minimax',
    name: 'MiniMax Agent',
    url: 'https://agent.minimaxi.com/',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'chatglm',
    name: '智谱清言',
    url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://www.kimi.com/zh',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'volcengine',
    name: '火山',
    url: 'https://exp.volcengine.com/ark?mode=chat&modelId=doubao-seed-evolving-latest-version',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'mimo',
    name: 'MiMo Studio',
    url: 'https://aistudio.xiaomimimo.com/#/c',
    region: 'domestic',
    category: 'chat',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    url: 'https://yuanbao.tencent.com/chat/',
    region: 'domestic',
    category: 'chat',
  },
  // 国外
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    region: 'international',
    category: 'chat',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/',
    region: 'international',
    category: 'chat',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    region: 'international',
    category: 'chat',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    region: 'international',
    category: 'chat',
  },
  {
    id: 'meta',
    name: 'Meta AI',
    url: 'https://www.meta.ai/',
    region: 'international',
    category: 'chat',
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com/',
    region: 'international',
    category: 'chat',
  },
  {
    id: 'copilot',
    name: 'Copilot',
    url: 'https://copilot.microsoft.com/',
    region: 'international',
    category: 'chat',
  },
];

export const DEFAULT_IMAGE_TOOLS: AITool[] = [
  // 国内
  {
    id: 'jimeng',
    name: '即梦 AI',
    url: 'https://jimeng.jianying.com/ai-tool/image/generate',
    region: 'domestic',
    category: 'image',
  },
  {
    id: 'wanxiang',
    name: '通义万相',
    url: 'https://tongyi.aliyun.com/wanxiang/',
    region: 'domestic',
    category: 'image',
  },
  {
    id: 'kling',
    name: '可灵 AI',
    url: 'https://klingai.com/app/image/new',
    region: 'domestic',
    category: 'image',
  },
  {
    id: 'liblib',
    name: 'LiblibAI',
    url: 'https://www.liblib.art/sd',
    region: 'domestic',
    category: 'image',
  },
  {
    id: 'yige',
    name: '文心一格',
    url: 'https://yige.baidu.com/',
    region: 'domestic',
    category: 'image',
  },
  {
    id: 'miaohua',
    name: '秒画',
    url: 'https://miaohua.sensetime.com/',
    region: 'domestic',
    category: 'image',
  },
  {
    id: 'doubao-image',
    name: '豆包绘图',
    url: 'https://www.doubao.com/chat/create-image',
    region: 'domestic',
    category: 'image',
  },
  // 国外
  {
    id: 'midjourney',
    name: 'Midjourney',
    url: 'https://www.midjourney.com/',
    region: 'international',
    category: 'image',
  },
  {
    id: 'leonardo',
    name: 'Leonardo.ai',
    url: 'https://leonardo.ai/',
    region: 'international',
    category: 'image',
  },
  {
    id: 'ideogram',
    name: 'Ideogram',
    url: 'https://ideogram.ai/',
    region: 'international',
    category: 'image',
  },
  {
    id: 'firefly',
    name: 'Adobe Firefly',
    url: 'https://firefly.adobe.com/',
    region: 'international',
    category: 'image',
  },
  {
    id: 'bing-create',
    name: 'Bing 图像创建',
    url: 'https://www.bing.com/images/create',
    region: 'international',
    category: 'image',
  },
  {
    id: 'stability',
    name: 'Stability AI',
    url: 'https://stability.ai/stable-image',
    region: 'international',
    category: 'image',
  },
  {
    id: 'recraft',
    name: 'Recraft',
    url: 'https://www.recraft.ai/',
    region: 'international',
    category: 'image',
  },
];

export const ALL_DEFAULT_TOOLS: AITool[] = [...DEFAULT_CHAT_TOOLS, ...DEFAULT_IMAGE_TOOLS];

/** 首次安装时默认关闭的网站，可在「网站管理」设置中启用 */
export const DEFAULT_DISABLED_TOOL_IDS = ['meta', 'mimo', 'recraft', 'stability'];

export function getToolsByCategory(category: ToolCategory): AITool[] {
  return ALL_DEFAULT_TOOLS.filter((tool) => tool.category === category);
}

export function groupToolsByRegion(tools: AITool[]): ToolRegionGroup[] {
  return TOOL_REGION_ORDER.map((region) => ({
    region,
    label: TOOL_REGION_LABELS[region],
    tools: tools.filter((tool) => tool.region === region),
  })).filter((group) => group.tools.length > 0);
}

export function findToolById(toolId: string): AITool | undefined {
  return ALL_DEFAULT_TOOLS.find((tool) => tool.id === toolId);
}
