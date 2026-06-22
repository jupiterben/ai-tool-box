import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class KimiHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'kimi',
    urlHint: 'kimi.com',
    urlHints: ['kimi.com', 'www.kimi.com'],
    inputSelectors: [
      '[data-lexical-editor="true"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[role="textbox"][contenteditable="true"]',
      "textarea[placeholder*='问']",
      "textarea[placeholder*='尽管']",
      'textarea',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      '[class*="send-button"]',
      'button[type="submit"]',
    ],
    sendMethod: 'enter',
    responseSelectors: [
      '.markdown-body',
      '[class*="assistant-message"]',
      '[class*="bot-message"]',
      '[data-role="assistant"]',
      '[class*="message-content"]',
    ],
    userMessageSelectors: [
      '[class*="user-message"]',
      '[data-role="user"]',
      '[class*="human-message"]',
    ],
  };
}

export const kimiHandler = new KimiHandler();
