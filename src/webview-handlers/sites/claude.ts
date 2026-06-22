import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class ClaudeHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'claude',
    urlHint: 'claude.ai',
    inputSelectors: [
      'div.ProseMirror',
      '[data-testid="composer-input"]',
      '[aria-label="Message Claude"][contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      '[data-placeholder][contenteditable="true"]',
      "div[contenteditable='true']",
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button[aria-label="Send message"]',
      'button[data-testid="send-button"]',
      "button[type='submit']",
    ],
    sendMethod: 'click',
    responseSelectors: [
      '.font-claude-response',
      '[data-is-streaming]',
      '[data-testid="assistant-message"]',
      '[class*="assistant"]',
    ],
    userMessageSelectors: ['[data-testid="user-message"]', '.font-user-message'],
  };
}

export const claudeHandler = new ClaudeHandler();
