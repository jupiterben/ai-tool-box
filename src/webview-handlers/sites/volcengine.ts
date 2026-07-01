import { BaseSiteHandler } from '../BaseSiteHandler';
import type { InjectScriptOverrides } from '../browserRuntime';
import type { SiteHandlerConfig } from '../types';

export class VolcengineHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'volcengine',
    urlHint: 'exp.volcengine.com',
    urlHints: ['exp.volcengine.com', 'volcengine.com'],
    inputSelectors: [
      'textarea[data-testid="chat_input_input"]',
      'textarea[placeholder*="发消息"]',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="问"]',
      'textarea[placeholder*="消息"]',
      'div[role="textbox"][contenteditable="true"]',
      "div[contenteditable='true']",
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      '[data-testid="chat_input_send_button"]',
      'button[aria-label*="发送"]',
      'button[type="submit"]',
    ],
    sendMethod: 'enter',
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

  /** 供主进程原生 insertText + Enter 聚焦输入框 */
  protected buildInjectOverrides(): InjectScriptOverrides {
    return {
      extraInjectRuntime: `
      window.__volcengineFocusInput__ = function() {
        return __focusInput();
      };

      window.__volcengineGetInputRemaining__ = function() {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到输入框', remaining: '' };
        var remaining = input.isContentEditable
          ? (input.textContent || '').trim()
          : (input.value || '').trim();
        return { success: true, remaining: remaining };
      };
      `,
    };
  }
}

export const volcengineHandler = new VolcengineHandler();
