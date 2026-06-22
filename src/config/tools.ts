import { AITool } from '../types/ai-tool';

export const DEFAULT_TOOLS: AITool[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
  },
  {
    id: 'qianwen',
    name: '千问',
    url: 'https://www.qianwen.com/chat',
  },
  {
    id: 'minimax',
    name: 'MiniMax Agent',
    url: 'https://agent.minimaxi.com/',
  },
  {
    id: 'chatglm',
    name: '智谱清言',
    url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://www.kimi.com/zh',
  },
  {
    id: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
  },
];
