export type InputType = 'textarea' | 'input' | 'contenteditable';
export type SendMethod = 'click' | 'enter' | 'submit';

/** 单个 AI 站点的 webview 输入/发送配置 */
export interface SiteHandlerConfig {
  toolId: string;
  /** 主进程按 URL 查找 webContents 时的域名片段 */
  urlHint: string;
  inputSelectors: string[];
  inputType: InputType;
  /** 全局发送按钮选择器（逗号分隔传给 querySelector） */
  sendButtonSelectors?: string[];
  sendMethod: SendMethod;
  /** 从输入框向上 walk DOM 时，每层额外尝试的发送按钮选择器 */
  nearInputSendSelectors?: string[];
  /** 发送按钮处于禁用状态时匹配的 class（如 ant-sender-actions-btn-disabled） */
  sendDisabledClasses?: string[];
}

/** 与旧版 inputSelectors 兼容 */
export interface WebviewInputSelector {
  toolId: string;
  selectors: string[];
  inputType: InputType;
  sendButtonSelector?: string;
  sendMethod: SendMethod;
}

export interface WebviewInputHandlerResult {
  success: boolean;
  error?: string;
}
