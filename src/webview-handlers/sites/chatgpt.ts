import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class ChatGptHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'chatgpt',
    urlHint: 'chatgpt.com',
    urlHints: ['chatgpt.com', 'openai.com'],
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
    newChatAction: {
      selectors: ['[data-testid="create-new-chat-button"]', 'a[href="/"]'],
      textIncludes: ['New chat', '新对话'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['nav ol', 'nav [role="list"]', '[data-testid="history"]', 'aside nav'],
        itemSelectors: ['a', '[role="button"]', 'li'],
        skipTextIncludes: ['New chat', '新对话', 'Library', 'GPTs', 'Explore'],
        index: 0,
      },
    },
  };
}

export const chatgptHandler = new ChatGptHandler();
