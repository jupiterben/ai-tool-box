import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class CopilotHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'copilot',
    urlHint: 'copilot.microsoft.com',
    urlHints: ['copilot.microsoft.com'],
    inputSelectors: [
      'textarea#userInput',
      'textarea[data-testid="composer-input"]',
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='Ask']",
      'div[role="textbox"][contenteditable="true"]',
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      'button[aria-label*="Submit"]',
      'button[aria-label*="Send"]',
      "button[type='submit']",
    ],
    sendMethod: 'enter',
    responseSelectors: [
      '[data-content="assistant"]',
      '.bot-turn',
      '[data-testid="response-message"]',
      '.ac-textBlock',
      '[class*="response"]',
    ],
    userMessageSelectors: [
      '[data-content="user"]',
      '.user-turn',
      '[class*="user-message"]',
    ],
    newChatAction: {
      url: 'https://copilot.microsoft.com/',
      textIncludes: ['New chat', '新对话'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['aside', '[class*="sidebar"]', 'nav'],
        itemSelectors: ['a', '[role="button"]', '[role="link"]'],
        skipTextIncludes: ['New chat', '新对话'],
        index: 0,
      },
    },
  };
}

export const copilotHandler = new CopilotHandler();
