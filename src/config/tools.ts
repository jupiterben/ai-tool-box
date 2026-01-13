import { AITool } from '../types/ai-tool';

export const DEFAULT_TOOLS: AITool[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
  },
  {
    id: 'prompt-expander',
    name: 'Prompt拓展工具',
    url: '',
    description: '通过AI辅助迭代拓展生成详细提示词',
  },
];
