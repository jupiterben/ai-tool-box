import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class MinimaxHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'minimax',
    urlHint: 'minimaxi.com',
    inputSelectors: [
      'div.ProseMirror',
      '[data-placeholder][contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      "div[contenteditable='true']",
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='Agent']",
      "textarea[placeholder*='任务']",
      'textarea',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      "button[type='submit']",
      'button.ant-btn-primary',
      '[aria-label*="Send"]',
      '[aria-label*="发送"]',
    ],
    sendMethod: 'click',
    responseSelectors: [
      '.markdown',
      '[class*="assistant"]',
      '[class*="Assistant"]',
      '[class*="message-content"]',
    ],
    userMessageSelectors: ['[class*="user"]', '[class*="User"]'],
    newChatAction: {
      url: 'https://agent.minimaxi.com/',
      textIncludes: ['新对话', '新建'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['aside', '[class*="sidebar"]', '[class*="history"]'],
        itemSelectors: ['a', '[role="button"]', 'li'],
        skipTextIncludes: ['新对话', '新建'],
        index: 0,
      },
    },
  };
}

export const minimaxHandler = new MinimaxHandler();
