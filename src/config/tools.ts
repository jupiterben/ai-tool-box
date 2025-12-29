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
];
