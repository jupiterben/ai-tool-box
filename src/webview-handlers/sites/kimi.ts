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
      '.chat-content-list .chat-content-item-assistant .markdown-body',
      '.chat-content-list .chat-content-item-assistant',
      '.segment-assistant .markdown-body',
      '.segment-assistant',
      '.message-list .chat-content-item-assistant',
      '.chat-content-list .segment-assistant',
      '[class*="markdown"]:not([class*="user-content"])',
    ],
    userMessageSelectors: [
      '.chat-content-list .chat-content-item-user',
      '.segment-user',
      '[class*="user-content"]',
      '.chat-content-list .chat-content-item:not(.chat-content-item-assistant)',
    ],
    newChatAction: {
      url: 'https://www.kimi.com/zh',
      textIncludes: ['新建会话', '新对话'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['aside', '[class*="sidebar"]', '[class*="history"]'],
        itemSelectors: ['a', '[role="button"]', '[class*="session"]', 'li'],
        skipTextIncludes: ['新建会话', '新对话', '新建'],
        index: 0,
      },
    },
  };
}

export const kimiHandler = new KimiHandler();
