/** 参考图上传配置 */
export interface ReferenceImageConfig {
  /** 文件 input 选择器 */
  inputSelectors?: string[];
  /** 点击后才会出现 file input 的按钮/区域 */
  triggerSelectors?: string[];
  /** 上传完成后等待毫秒 */
  waitAfterUploadMs?: number;
}

export type InputType = 'textarea' | 'input' | 'contenteditable';
export type SendMethod = 'click' | 'enter' | 'submit';
export type ConversationActionType = 'newChat' | 'recentChat';

/** 侧边栏会话列表：点击第 index 个可见会话项 */
export interface ConversationListConfig {
  containerSelectors: string[];
  itemSelectors: string[];
  /** 跳过包含这些文案的项（如「新对话」按钮） */
  skipTextIncludes?: string[];
  /** 取第几个可见会话，默认 0 = 最近一次 */
  index?: number;
}

/** 站点内新建/切换对话的操作配置 */
export interface ConversationActionConfig {
  /** 直接跳转 URL（新建对话时最可靠） */
  url?: string;
  /** 依次尝试点击的选择器 */
  selectors?: string[];
  /** 按按钮/链接文案匹配（包含即命中） */
  textIncludes?: string[];
  /** 从侧边栏会话列表中选择 */
  conversationList?: ConversationListConfig;
}

/** 单个 AI 站点的 webview 输入/发送配置 */
export interface SiteHandlerConfig {
  toolId: string;
  /** 主进程按 URL 查找 webContents 时的域名片段 */
  urlHint: string;
  /** 多个 URL 片段，用于 redirect 后的站点（如 chatgpt.com / openai.com） */
  urlHints?: string[];
  /** 限定输入框查找范围（按顺序尝试，命中即用） */
  inputRootSelectors?: string[];
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
  /** 新建对话 */
  newChatAction?: ConversationActionConfig;
  /** 回到最近一次对话 */
  recentChatAction?: ConversationActionConfig;
  /** 参考图上传（生图站点） */
  referenceImage?: ReferenceImageConfig;
  /** 生成结果图片的 DOM 选择器 */
  imageResultSelectors?: string[];
  /** 限定图片查找范围 */
  imageResultRootSelectors?: string[];
  /** 忽略小于该尺寸（px）的图片 */
  imageResultMinSize?: number;
  /** 生图失败提示的 DOM 选择器，命中后会提前终止等待图片 */
  imageFailureSelectors?: string[];
  /** 生图失败提示文本，大小写不敏感，命中后会提前终止等待图片 */
  imageFailureTexts?: string[];
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
