import { BaseSiteHandler } from '../BaseSiteHandler';
import type { SiteHandlerConfig } from '../types';

export class QianwenHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'qianwen',
    urlHint: 'qianwen.com',
    inputSelectors: [
      'textarea.ant-sender-input',
      'div.ant-sender-input[contenteditable="true"]',
      '.ant-sender-input[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      "textarea[placeholder*='千问']",
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='消息']",
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      'button.ant-sender-actions-btn.ant-btn-primary',
      'div.omni-button-content button.ant-btn-primary',
      'button.ant-sender-actions-btn',
    ],
    nearInputSendSelectors: [
      'button.ant-sender-actions-btn.ant-btn-primary',
      'div.omni-button-content button.ant-btn-primary',
    ],
    sendDisabledClasses: ['ant-sender-actions-btn-disabled'],
    sendMethod: 'enter',
  };
}

export const qianwenHandler = new QianwenHandler();
