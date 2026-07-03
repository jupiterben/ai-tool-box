import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

const DEFAULT_REFERENCE_IMAGE = {
  inputSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  triggerSelectors: [
    '[aria-label*="Upload" i]',
    '[aria-label*="上传"]',
    '[aria-label*="upload" i]',
    'button[aria-label*="Upload" i]',
  ],
  waitAfterUploadMs: 1000,
};

const DEFAULT_IMAGE_RESULT_SELECTORS = [
  'a[id^="img-cont-"] img[src*="/th/id/OIG"]',
  'a[id^="img-cont-"] img[src*="pid=ImgGn"]',
  'img.image-row-img[src*="/th/id/OIG"]',
  'img.image-row-img[src*="pid=ImgGn"]',
  'a[id^="img-cont-"] img',
  'img.image-row-img',
];

export class BingCreateHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'bing-create',
    urlHint: 'bing.com',
    urlHints: ['bing.com/images/create', 'bing.com', 'www.bing.com'],
    inputRootSelectors: [
      '#create_input_form',
      '#gir_form',
      '[class*="ImageCreator"]',
      '[class*="image-creator"]',
      '[class*="gi_form"]',
      'main',
    ],
    inputSelectors: [
      'textarea.b_searchbox.gi_sb',
      'textarea.b_searchbox',
      'textarea.gi_sb',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="描述" i]',
      'textarea[aria-label*="Describe" i]',
      'textarea[aria-label*="描述" i]',
      'textarea[aria-label*="prompt" i]',
      'div[role="textbox"][contenteditable="true"]',
      '#sb_form_q',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      '#create_btn_c',
      'a#create_btn_c',
      '#create_btn',
      'a[aria-label*="生成"]',
      'a[aria-label*="Generate" i]',
      'a[aria-label*="Create" i]',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="生成" i]',
      'button[aria-label*="Create" i]',
    ],
    nearInputSendSelectors: [
      '#create_btn_c',
      'a#create_btn_c',
      '#create_btn',
      'a[aria-label*="生成"]',
      'a[aria-label*="Generate" i]',
    ],
    preferNearInputSendButton: true,
    sendMethod: 'click',
    sendButtonWaitMs: 10000,
    sendDisabledClasses: ['disabled', 'ellipsis', 'gi_btn_disabled'],
    referenceImage: DEFAULT_REFERENCE_IMAGE,
    imageResultSelectors: DEFAULT_IMAGE_RESULT_SELECTORS,
    imageResultRootSelectors: ['main', 'body'],
    imageResultMinSize: 128,
  };
}

export const bingCreateHandler = new BingCreateHandler();
