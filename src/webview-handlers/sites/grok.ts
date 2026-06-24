import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class GrokHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'grok',
    urlHint: 'grok.com',
    urlHints: ['grok.com', 'x.com'],
    inputSelectors: [
      "textarea[placeholder*='Ask']",
      "textarea[data-testid='grok-input']",
      "textarea[data-testid='tweetTextarea_0']",
      '[contenteditable="true"][aria-label*="message" i]',
      'div[role="textbox"][contenteditable="true"]',
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      'button[aria-label*="Send"]',
      'button[data-testid="send-button"]',
      "button[type='submit']",
    ],
    sendMethod: 'enter',
    responseSelectors: [
      '[data-testid="grok-response"]',
      '.grok-response',
      "[class*='response']",
    ],
    userMessageSelectors: [
      '[data-testid="user-message"]',
      '.user-message',
    ],
    newChatAction: {
      url: 'https://grok.com/',
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

export const grokHandler = new GrokHandler();
