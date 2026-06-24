import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class GeminiHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'gemini',
    urlHint: 'gemini.google.com',
    inputSelectors: [
      'div.ql-editor[contenteditable="true"]',
      '.ql-editor[contenteditable="true"]',
      'rich-textarea [contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="prompt"]',
      '[aria-label*="message"][contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      "div[contenteditable='true']",
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      '.send-button',
      'button.send-button',
    ],
    sendMethod: 'click',
    responseSelectors: [
      'message-content .markdown',
      'message-content',
      '.response-content',
      'model-response',
      '.model-response-text',
      '[data-message-author="model"]',
    ],
    userMessageSelectors: [
      '.query-text',
      '.user-query',
      'user-query',
      '[data-message-author="user"]',
      '.conversation-turn-user',
    ],
    newChatAction: {
      url: 'https://gemini.google.com/app',
      textIncludes: ['New chat', '新对话'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['[class*="conversation"]', 'aside', 'nav'],
        itemSelectors: ['a', '[role="button"]', '[role="link"]', 'mat-list-item'],
        skipTextIncludes: ['New chat', '新对话', 'Gemini'],
        index: 0,
      },
    },
  };
}

export const geminiHandler = new GeminiHandler();
