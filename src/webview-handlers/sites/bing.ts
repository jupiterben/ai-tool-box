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
  '#girrcc img',
  '#gilen_c img',
  'img[src*="th.bing.com"]',
  'img[src*="mm.bing.net"]',
  'img[src*="bing.com/th"]',
  '.gir_img img',
  '.girr_set img',
  'main img[src]',
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
      'textarea[aria-label*="Describe" i]',
      'textarea[aria-label*="描述" i]',
      'textarea[aria-label*="prompt" i]',
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="描述" i]',
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="Describe" i]',
      'div[contenteditable="true"][aria-label*="描述" i]',
      'textarea.b_searchbox',
      'textarea.gi_sb',
      '#sb_form_q',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      '#create_btn_c',
      'button#create_btn_c',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="生成" i]',
      'button[aria-label*="Create" i]',
    ],
    nearInputSendSelectors: [
      '#create_btn_c',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="生成" i]',
    ],
    preferNearInputSendButton: true,
    sendMethod: 'click',
    sendButtonWaitMs: 8000,
    sendDisabledClasses: ['disabled', 'ellipsis'],
    referenceImage: DEFAULT_REFERENCE_IMAGE,
    imageResultSelectors: DEFAULT_IMAGE_RESULT_SELECTORS,
    imageResultRootSelectors: ['#girrcc', '#gilen_c', 'main', 'body'],
    imageResultMinSize: 128,
  };
}

export const bingCreateHandler = new BingCreateHandler();
