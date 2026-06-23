import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class MimoHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'mimo',
    urlHint: 'xiaomimimo.com',
    urlHints: ['aistudio.xiaomimimo.com', 'xiaomimimo.com'],
    inputSelectors: [
      'div[role="textbox"][contenteditable="true"]',
      '[data-lexical-editor="true"]',
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='问']",
      "textarea[placeholder*='消息']",
      "textarea[placeholder*='prompt' i]",
      'div.ProseMirror',
      "div[contenteditable='true']",
      'textarea',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      "button[type='submit']",
      'button.ant-btn-primary',
    ],
    sendMethod: 'enter',
    responseSelectors: [
      '.markdown-body',
      '.markdown',
      '[class*="markdown"]',
      '[class*="assistant"]',
      '[class*="Assistant"]',
      '[class*="message-content"]',
    ],
    userMessageSelectors: [
      '[class*="user"]',
      '[class*="User"]',
      '[class*="question"]',
    ],
  };
}

export const mimoHandler = new MimoHandler();
