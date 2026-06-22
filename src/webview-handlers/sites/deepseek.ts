import { BaseSiteHandler } from '../BaseSiteHandler';
import { DEEPSEEK_NEAR_INPUT_SEARCH } from '../browserRuntime';
import type { SiteHandlerConfig } from '../types';

export class DeepSeekHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'deepseek',
    urlHint: 'deepseek.com',
    inputSelectors: [
      '#chat-input',
      'textarea[name="search"]',
      "textarea[placeholder='Message DeepSeek']",
      'textarea[placeholder*="Send a message"]',
      'textarea[data-testid="chat-input"]',
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='message']",
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      '[role="button"].ds-icon-button',
      'button[aria-label="Send message"]',
      '[data-testid="send-button"]',
      "button[type='submit']",
    ],
    sendMethod: 'click',
  };

  protected buildFindSendButtonNearInputBody(): string {
    return DEEPSEEK_NEAR_INPUT_SEARCH;
  }
}

export const deepseekHandler = new DeepSeekHandler();
