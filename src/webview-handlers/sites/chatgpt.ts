import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class ChatGptHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'chatgpt',
    urlHint: 'openai.com',
    inputSelectors: [
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='message']",
      "textarea[id*='prompt']",
      "textarea[data-id*='root']",
      "textarea",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
    ],
    inputType: 'textarea',
    sendButtonSelectors: ["button[type='submit']"],
    sendMethod: 'click',
    responseSelectors: [
      '[data-message-author-role="assistant"]',
      '.markdown.prose',
      '[data-testid*="assistant"]',
      '.agent-turn',
    ],
    userMessageSelectors: ['[data-message-author-role="user"]', '[data-testid="user-message"]'],
  };
}

export const chatgptHandler = new ChatGptHandler();
