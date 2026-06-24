import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class HunyuanHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'hunyuan',
    urlHint: 'yuanbao.tencent.com',
    urlHints: ['yuanbao.tencent.com', 'hunyuan.tencent.com'],
    inputSelectors: [
      '.agent-dialogue__content--common__input .ql-editor[contenteditable="true"]',
      '#search-bar .ql-editor[contenteditable="true"]',
      '.ql-editor[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='问']",
      'textarea',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      '#yuanbao-send-btn',
      'button[aria-label*="发送"]',
      '[class*="send-btn"]',
      "button[type='submit']",
    ],
    sendMethod: 'click',
    responseSelectors: [
      '.agent-chat__list__item--ai .hyc-common-markdown-style',
      '.agent-chat__list__item--ai .hyc-content-md-done',
      '.agent-chat__list__item--ai',
      '[data-conv-speaker="ai"] .hyc-common-markdown-style',
      '[data-conv-speaker="ai"]',
      '.hyc-common-markdown-style',
    ],
    userMessageSelectors: [
      'div[data-conv-speaker="human"] .hyc-content-text',
      '.agent-chat__bubble--human .hyc-content-text',
      '.agent-chat__bubble--human',
      'div[data-conv-speaker="human"]',
    ],
    newChatAction: {
      url: 'https://yuanbao.tencent.com/chat/',
      textIncludes: ['新对话', '新建对话'],
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

export const hunyuanHandler = new HunyuanHandler();
