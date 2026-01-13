/**
 * Prompt迭代拓展生成工具类型定义
 */

/**
 * 拓展方向选项
 */
export interface ExpansionOption {
  id: string;                    // 唯一标识符
  title: string;                 // 标题（简短描述，<100字符）
  description: string;           // 详细说明（<500字符）
  generatedAt: string;           // 生成时间戳
}

/**
 * 拓展步骤
 */
export interface ExpansionStep {
  iteration: number;              // 迭代次数（1-10）
  options: ExpansionOption[];    // 生成的拓展方向列表（3-5个）
  selectedOptionId: string | null; // 用户选择的方向ID（null表示未选择）
  selectedAt: string | null;      // 选择时间戳
  createdAt: string;              // 步骤创建时间
}

/**
 * 拓展历史
 */
export interface ExpansionHistory {
  steps: ExpansionStep[];        // 所有迭代步骤
  totalIterations: number;       // 总迭代次数（steps.length）
  startedAt: string;             // 开始时间
  completedAt: string | null;     // 完成时间（null表示未完成）
}

/**
 * 最终提示词
 */
export interface FinalPrompt {
  content: string;               // 提示词内容（200-5000字符）
  format: 'text' | 'markdown';    // 格式类型
  wordCount: number;             // 字数统计
  paragraphCount: number;        // 段落数统计
  generatedAt: string;            // 生成时间戳
}

/**
 * Prompt拓展工具状态
 */
export interface PromptExpanderState {
  // 初始输入
  initialRequirement: string;     // 初始需求（10-2000字符）
  
  // 当前迭代状态
  currentIteration: number;        // 当前迭代次数（0-10，0表示未开始）
  currentStep: ExpansionStep | null; // 当前步骤（null表示未开始或已完成）
  
  // 历史记录
  expansionHistory: ExpansionHistory | null; // 拓展历史（null表示未开始）
  
  // 最终结果
  finalPrompt: FinalPrompt | null; // 最终提示词（null表示未生成）
  
  // UI状态
  isLoading: boolean;             // 是否正在加载（AI调用中）
  error: string | null;           // 错误信息（null表示无错误）
  
  // 元数据
  createdAt: string;            // 状态创建时间
  updatedAt: string;             // 最后更新时间
}

/**
 * 保存的提示词
 */
export interface SavedPrompt {
  id: string;                     // 唯一标识符（UUID）
  initialRequirement: string;      // 初始需求
  expansionHistory: ExpansionHistory; // 拓展历史
  finalPrompt: FinalPrompt;        // 最终提示词
  metadata: {
    createdAt: string;            // 创建时间
    savedAt: string;              // 保存时间
    iterationCount: number;       // 迭代次数
    version: string;              // 数据版本（用于兼容性）
  };
}

/**
 * IPC请求/响应接口
 */

// AI服务调用
export interface GenerateExpansionOptionsRequest {
  initialRequirement: string;      // 初始需求
  currentContext: string;          // 当前上下文（包含之前的选择）
  iteration: number;               // 当前迭代次数
  count?: number;                  // 生成数量（默认5，范围3-5）
  provider?: 'openai' | 'deepseek'; // AI服务提供商（默认'deepseek'）
}

export interface GenerateExpansionOptionsResponse {
  success: boolean;
  options?: ExpansionOption[];     // 拓展方向列表
  error?: string;                   // 错误信息
}

export interface GenerateFinalPromptRequest {
  initialRequirement: string;     // 初始需求
  expansionHistory: ExpansionHistory; // 完整的拓展历史
  format?: 'text' | 'markdown';    // 输出格式（默认'markdown'）
  provider?: 'openai' | 'deepseek'; // AI服务提供商（默认'deepseek'）
}

export interface GenerateFinalPromptResponse {
  success: boolean;
  prompt?: FinalPrompt;            // 最终提示词
  error?: string;                   // 错误信息
}

// 存储服务
export interface SavePromptRequest {
  prompt: SavedPrompt;             // 要保存的提示词数据
}

export interface SavePromptResponse {
  success: boolean;
  filePath?: string;                // 保存的文件路径
  error?: string;                    // 错误信息
}

export interface LoadPromptListRequest {
  limit?: number;                  // 返回数量限制（默认50）
  offset?: number;                 // 偏移量（默认0）
}

export interface LoadPromptListResponse {
  success: boolean;
  prompts?: Array<{
    id: string;
    initialRequirement: string;
    finalPrompt: {
      content: string;
      wordCount: number;
    };
    metadata: {
      createdAt: string;
      savedAt: string;
      iterationCount: number;
    };
  }>;
  total?: number;                   // 总数
  error?: string;
}

export interface LoadPromptRequest {
  id: string;                      // 提示词ID
}

export interface LoadPromptResponse {
  success: boolean;
  prompt?: SavedPrompt;            // 完整的提示词数据
  error?: string;
}

export interface DeletePromptRequest {
  id: string;                      // 提示词ID
}

export interface DeletePromptResponse {
  success: boolean;
  error?: string;
}

// 文件导出
export interface ExportPromptRequest {
  prompt: FinalPrompt;             // 要导出的提示词
  format: 'txt' | 'md';            // 导出格式
  includeMetadata?: boolean;        // 是否包含元数据（默认true）
  metadata?: {
    initialRequirement: string;
    iterationCount: number;
    createdAt: string;
  };
}

export interface ExportPromptResponse {
  success: boolean;
  filePath?: string;                // 保存的文件路径
  cancelled?: boolean;              // 用户是否取消了对话框
  error?: string;
}
