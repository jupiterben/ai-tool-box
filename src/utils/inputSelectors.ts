import { WebviewInputSelector } from '../types/webview-input-selector';

/**
 * 默认的输入框选择器配置
 * 为每个 AI 工具配置输入框识别策略
 */
export const INPUT_SELECTORS: Record<string, WebviewInputSelector> = {
  chatgpt: {
    toolId: 'chatgpt',
    selectors: [
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='message']",
      "textarea[id*='prompt']",
      "textarea[data-id*='root']",
      "textarea",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
    ],
    inputType: 'textarea',
    sendButtonSelector: "button[type='submit']",
    sendMethod: 'click',
  },
  deepseek: {
    toolId: 'deepseek',
    selectors: [
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='message']",
      "textarea[id*='input']",
      "textarea",
      "input[type='text']",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
    ],
    inputType: 'textarea',
    sendButtonSelector: "button[type='submit']",
    sendMethod: 'click',
  },
};

/**
 * 获取指定工具的输入框选择器配置
 */
export function getInputSelector(toolId: string): WebviewInputSelector | undefined {
  return INPUT_SELECTORS[toolId];
}
