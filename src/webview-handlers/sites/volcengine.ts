import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class VolcengineHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'volcengine',
    urlHint: 'exp.volcengine.com',
    urlHints: ['exp.volcengine.com', 'volcengine.com'],
    inputSelectors: [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="问"]',
      'textarea[placeholder*="消息"]',
      'div[role="textbox"][contenteditable="true"]',
      "div[contenteditable='true']",
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      'button[aria-label*="发送"]',
      'button[type="submit"]',
      '[class*="send"]',
    ],
    sendMethod: 'click',
    responseSelectors: [
      '[class*="markdown"]',
      '[class*="assistant"]',
      '[class*="message-content"]',
      '[class*="answer"]',
    ],
    userMessageSelectors: ['[class*="user"]', '[class*="question"]'],
    newChatAction: {
      url: 'https://exp.volcengine.com/ark?mode=chat&modelId=doubao-seed-evolving-latest-version',
      textIncludes: ['新对话', '新建对话', '新建'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['aside', '[class*="sidebar"]', '[class*="conversation-list"]'],
        itemSelectors: ['a', '[role="button"]', 'li'],
        skipTextIncludes: ['新对话', '新建对话', '新建'],
        index: 0,
      },
    },
  };
}

export const volcengineHandler = new VolcengineHandler();
