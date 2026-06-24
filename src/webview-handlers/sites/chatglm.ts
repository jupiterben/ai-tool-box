import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class ChatGlmHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'chatglm',
    urlHint: 'chatglm.cn',
    inputSelectors: [
      "textarea[slot='reference']",
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='问']",
      'div[role="textbox"][contenteditable="true"]',
      "div[contenteditable='true']",
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      "button[type='submit']",
      'button.ant-btn-primary',
      '[aria-label*="发送"]',
      '[aria-label*="Send"]',
    ],
    sendMethod: 'enter',
    responseSelectors: [
      '.markdown-body',
      '[class*="answer"]',
      '[class*="assistant"]',
      '[class*="Assistant"]',
    ],
    userMessageSelectors: ['[class*="question"]', '[class*="user"]'],
    newChatAction: {
      url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh',
      textIncludes: ['新对话', '新建'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['aside', '[class*="sidebar"]', '[class*="history"]'],
        itemSelectors: ['a', '[role="button"]', 'li'],
        skipTextIncludes: ['新对话', '新建', '历史'],
        index: 0,
      },
    },
  };
}

export const chatglmHandler = new ChatGlmHandler();
