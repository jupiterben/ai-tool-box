import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class DoubaoHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'doubao',
    urlHint: 'doubao.com',
    urlHints: ['doubao.com', 'www.doubao.com'],
    inputSelectors: [
      'textarea[data-testid="chat_input_input"]',
      'textarea[placeholder*="发消息"]',
      "textarea[placeholder*='输入']",
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      '[data-testid="chat_input_send_button"]',
      'button[aria-label*="发送"]',
      'button[type="submit"]',
    ],
    sendMethod: 'enter',
    responseSelectors: [
      '[data-testid*="assistant"]',
      '[class*="assistant-message"]',
      '[class*="bot-message"]',
      '[class*="message-content"]',
      '.markdown',
    ],
    userMessageSelectors: [
      '[data-testid*="user"]',
      '[class*="user-message"]',
      '[class*="human-message"]',
    ],
  };
}

export const doubaoHandler = new DoubaoHandler();
