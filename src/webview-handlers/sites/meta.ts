import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class MetaHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'meta',
    urlHint: 'meta.ai',
    urlHints: ['meta.ai', 'www.meta.ai'],
    inputSelectors: [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='Message']",
      'textarea',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button[aria-label*="Send"]',
      'button[aria-label*="Submit"]',
      'button[data-testid*="send"]',
      "button[type='submit']",
    ],
    sendMethod: 'click',
    responseSelectors: [
      '[data-testid*="assistant"]',
      '[data-testid*="response"]',
      '[class*="assistant"]',
      '[class*="response"]',
      '.markdown',
    ],
    userMessageSelectors: [
      '[data-testid*="user"]',
      '[class*="user-message"]',
    ],
  };
}

export const metaHandler = new MetaHandler();
