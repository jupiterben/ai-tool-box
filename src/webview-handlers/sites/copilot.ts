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
    // 2026-07 DOM：data-content/testid 为 ai-message（非 assistant）；优先 body 去掉 "Copilot said"
    responseSelectors: [
      '[data-testid="ai-message-body"]',
      '[data-testid="ai-message"]',
      '[data-content="ai-message"]',
      '[data-content="assistant"]',
      '.bot-turn',
      '[data-testid="response-message"]',
      '.ac-textBlock',
    ],
    userMessageSelectors: [
      '[data-content="user-message"]',
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
