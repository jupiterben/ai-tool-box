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
      '.flow-markdown-body',
      '.md-box-root',
      '[class*="md-box-root"]',
      '[data-message-id]:not(.justify-end) .flow-markdown-body',
      '[class*="bg-g-receive-msg-bubble"] .flow-markdown-body',
      '[class*="bg-g-receive-msg-bubble"]',
      '[data-testid="receive_message"] .flow-markdown-body',
      '[data-testid="receive_message"]',
    ],
    userMessageSelectors: [
      '[data-message-id].justify-end [data-testid="message_text_content"]',
      '[data-message-id].justify-end',
      '[class*="bg-g-send-msg-bubble"]',
      '[data-testid="send_message"] [data-testid="message_text_content"]',
      '[data-testid="send_message"]',
    ],
  };
}

export const doubaoHandler = new DoubaoHandler();
