import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class PerplexityHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'perplexity',
    urlHint: 'perplexity.ai',
    urlHints: ['perplexity.ai', 'www.perplexity.ai'],
    inputSelectors: [
      'textarea#ask-input',
      'div#ask-input[contenteditable="true"]',
      '[role="textbox"][contenteditable="true"]',
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='Search']",
      "textarea[placeholder*='Follow']",
      'textarea',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button[aria-label="Submit"]',
      'button[aria-label*="Submit"]',
      'button[data-testid*="submit"]',
      "button[type='submit']",
    ],
    sendMethod: 'enter',
    responseSelectors: [
      'div[id^="markdown-content-"] .prose',
      'div[id^="markdown-content-"]',
      ".prose.dark\\:prose-invert",
      "div[class*='prose']",
    ],
    userMessageSelectors: [
      'span.select-text',
      "h1[class*='group/query']",
      'div.bg-offset.rounded-2xl span.select-text',
    ],
  };
}

export const perplexityHandler = new PerplexityHandler();
