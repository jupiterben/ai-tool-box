export type InputType = 'textarea' | 'input' | 'contenteditable';
export type SendMethod = 'click' | 'enter' | 'submit';

/** 单个 AI 站点的 webview 输入/发送配置 */
export interface SiteHandlerConfig {
  toolId: string;
  /** 主进程按 URL 查找 webContents 时的域名片段 */
  urlHint: string;
  /** 多个 URL 片段，用于 redirect 后的站点（如 chatgpt.com / openai.com） */
  urlHints?: string[];
  inputSelectors: string[];
  inputType: InputType;
  /** 全局发送按钮选择器（逗号分隔传给 querySelector） */
  sendButtonSelectors?: string[];
  sendMethod: SendMethod;
  /** 从输入框向上 walk DOM 时，每层额外尝试的发送按钮选择器 */
  nearInputSendSelectors?: string[];
  /** 发送按钮处于禁用状态时匹配的 class（如 ant-sender-actions-btn-disabled） */
  sendDisabledClasses?: string[];
  /** 优先在输入框附近查找发送按钮（千问等 Ant Design X 站点） */
  preferNearInputSendButton?: boolean;
  /** click 发送时等待按钮就绪的最长时间（毫秒） */
  sendButtonWaitMs?: number;
  /** AI 回复消息的 DOM 选择器（按优先级，取最后一个有效匹配节点） */
  responseSelectors?: string[];
  /** 用户消息的 DOM 选择器（可选，用于汇总文档上下文） */
  userMessageSelectors?: string[];
  /** 限定回复查找范围（按顺序尝试，命中即用） */
  responseRootSelectors?: string[];
  /** 忽略与 UI 标签完全一致的短文本（如侧边栏「最近对话」） */
  responseIgnoreTexts?: string[];
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
