import { buildInjectCheckScript } from './browserRuntime';
import { BaseSiteHandler, HANDLER_VERSION } from './BaseSiteHandler';
import { chatgptHandler } from './sites/chatgpt';
import { chatglmHandler } from './sites/chatglm';
import { claudeHandler } from './sites/claude';
import { deepseekHandler } from './sites/deepseek';
import { doubaoHandler } from './sites/doubao';
import { geminiHandler } from './sites/gemini';
import { kimiHandler } from './sites/kimi';
import { mimoHandler } from './sites/mimo';
import { minimaxHandler } from './sites/minimax';
import { perplexityHandler } from './sites/perplexity';
import { qianwenHandler } from './sites/qianwen';
import type { WebviewInputSelector } from './types';

export { HANDLER_VERSION } from './BaseSiteHandler';
export type { SiteHandlerConfig, WebviewInputSelector, WebviewInputHandlerResult } from './types';
export { BaseSiteHandler } from './BaseSiteHandler';

const HANDLERS: Record<string, BaseSiteHandler> = {
  chatgpt: chatgptHandler,
  deepseek: deepseekHandler,
  qianwen: qianwenHandler,
  minimax: minimaxHandler,
  chatglm: chatglmHandler,
  claude: claudeHandler,
  gemini: geminiHandler,
  kimi: kimiHandler,
  doubao: doubaoHandler,
  perplexity: perplexityHandler,
  mimo: mimoHandler,
};

export function getSiteHandler(toolId: string): BaseSiteHandler | undefined {
  return HANDLERS[toolId];
}

/** 兼容旧 API */
export function getInputSelector(toolId: string): WebviewInputSelector | undefined {
  return getSiteHandler(toolId)?.toSelectorConfig();
}

export function getAllSiteHandlers(): BaseSiteHandler[] {
  return Object.values(HANDLERS);
}

export function buildInjectCheckScriptForSite(toolId: string): string {
  return buildInjectCheckScript(toolId, HANDLER_VERSION);
}

// 各站点 handler 单独导出，便于按需扩展
export {
  chatgptHandler,
  deepseekHandler,
  qianwenHandler,
  minimaxHandler,
  chatglmHandler,
  claudeHandler,
  geminiHandler,
  kimiHandler,
  doubaoHandler,
  perplexityHandler,
  mimoHandler,
};
