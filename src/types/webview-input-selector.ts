/**
 * Webview 输入框选择器配置类型定义
 */

export interface WebviewInputSelector {
  toolId: string;
  selectors: string[];
  inputType: 'textarea' | 'input' | 'contenteditable';
  sendButtonSelector?: string;
  sendMethod: 'click' | 'enter' | 'submit';
}
