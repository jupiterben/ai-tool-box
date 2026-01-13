# 组件接口定义

## 概述

本文档定义React组件的Props接口和交互契约。

## 核心组件

### 1. PromptExpander (主组件)

**文件**: `src/components/PromptExpander/PromptExpander.tsx`

**Props**:
```typescript
interface PromptExpanderProps {
  // 无外部Props，组件自包含
}
```

**状态管理**:
- 使用`usePromptExpander` Hook管理状态
- 内部使用Context或Zustand（根据研究结果）

**子组件**:
- `InitialInput`
- `ExpansionOptions`
- `IterationProgress`
- `FinalPrompt`
- `HistoryView`

---

### 2. InitialInput (初始需求输入)

**文件**: `src/components/PromptExpander/InitialInput.tsx`

**Props**:
```typescript
interface InitialInputProps {
  value: string;                      // 当前输入值
  onChange: (value: string) => void;  // 输入变化回调
  onSubmit: (value: string) => void;   // 提交回调
  disabled?: boolean;                 // 是否禁用
  error?: string;                      // 错误信息
}
```

**验证规则**:
- 最小长度: 10字符
- 最大长度: 2000字符
- 非空验证

**交互**:
- 实时验证输入
- 显示字符计数
- 显示错误信息（如有）
- 提交按钮在输入有效时启用

---

### 3. ExpansionOptions (拓展方向展示)

**文件**: `src/components/PromptExpander/ExpansionOptions.tsx`

**Props**:
```typescript
interface ExpansionOptionsProps {
  options: ExpansionOption[];          // 拓展方向列表
  selectedId: string | null;            // 当前选中的ID
  onSelect: (optionId: string) => void; // 选择回调
  onConfirm: () => void;                // 确认选择回调
  isLoading?: boolean;                  // 是否正在加载
  error?: string;                       // 错误信息
  onRetry?: () => void;                 // 重试回调
}
```

**交互**:
- 卡片/列表形式展示选项
- 点击选项进行选择
- 选中状态有视觉反馈
- 确认按钮在选择后启用
- 支持取消选择
- 加载状态显示
- 错误状态显示重试按钮

---

### 4. IterationProgress (迭代进度)

**文件**: `src/components/PromptExpander/IterationProgress.tsx`

**Props**:
```typescript
interface IterationProgressProps {
  currentIteration: number;             // 当前迭代次数
  totalIterations: number;               // 总迭代次数（默认10）
  minIterations: number;                 // 最小迭代次数（默认5）
  onComplete?: () => void;               // 完成回调（提前结束）
  canComplete: boolean;                  // 是否可以提前完成（>= minIterations）
}
```

**显示内容**:
- 当前迭代次数（如 "迭代 3/10"）
- 进度条
- 提前完成按钮（如果canComplete为true）

---

### 5. FinalPrompt (最终提示词展示)

**文件**: `src/components/PromptExpander/FinalPrompt.tsx`

**Props**:
```typescript
interface FinalPromptProps {
  prompt: FinalPrompt;                  // 最终提示词数据
  onCopy: () => void;                   // 复制回调
  onSave: () => void;                   // 保存回调
  onExport: (format: 'txt' | 'md') => void; // 导出回调
  onRegenerate?: () => void;            // 重新生成回调
  isLoading?: boolean;                  // 是否正在生成
}
```

**功能**:
- 格式化显示提示词内容
- 支持Markdown渲染（如果format为'markdown'）
- 显示统计信息（字数、段落数）
- 一键复制功能
- 保存和导出按钮
- 重新生成按钮（可选）

---

### 6. HistoryView (历史记录查看)

**文件**: `src/components/PromptExpander/HistoryView.tsx`

**Props**:
```typescript
interface HistoryViewProps {
  history: ExpansionHistory;            // 拓展历史
  onNavigate?: (iteration: number) => void; // 导航到特定迭代
  expanded?: boolean;                   // 是否展开（默认false）
  onToggleExpand?: () => void;          // 切换展开状态
}
```

**显示内容**:
- 时间线或树状结构展示历史
- 每次迭代的拓展方向和选择
- 支持展开/折叠
- 支持导航到特定迭代

---

## Hooks接口

### 1. usePromptExpander

**文件**: `src/hooks/usePromptExpander.ts`

**返回值**:
```typescript
interface UsePromptExpanderReturn {
  // 状态
  state: PromptExpanderState;
  
  // 初始输入
  setInitialRequirement: (requirement: string) => void;
  startExpansion: () => Promise<void>;
  
  // 迭代流程
  selectExpansionOption: (optionId: string) => void;
  confirmSelection: () => Promise<void>;
  completeEarly: () => Promise<void>;
  
  // 最终提示词
  generateFinalPrompt: () => Promise<void>;
  regeneratePrompt: () => Promise<void>;
  
  // 历史记录
  viewHistory: () => void;
  
  // 保存和导出
  savePrompt: () => Promise<void>;
  exportPrompt: (format: 'txt' | 'md') => Promise<void>;
  
  // 重置
  reset: () => void;
  
  // 错误处理
  clearError: () => void;
  retry: () => Promise<void>;
}
```

**功能**:
- 管理完整的迭代流程状态
- 处理AI服务调用
- 处理状态转换
- 错误处理和重试

---

### 2. useAIService

**文件**: `src/hooks/useAIService.ts`

**返回值**:
```typescript
interface UseAIServiceReturn {
  generateExpansionOptions: (
    requirement: string,
    context: string,
    iteration: number
  ) => Promise<ExpansionOption[]>;
  
  generateFinalPrompt: (
    requirement: string,
    history: ExpansionHistory
  ) => Promise<FinalPrompt>;
  
  isLoading: boolean;
  error: string | null;
  retry: () => Promise<void>;
}
```

**功能**:
- 封装AI服务调用
- 处理加载状态
- 处理错误和重试
- 通过IPC与主进程通信

---

## 服务接口

### 1. AIService

**文件**: `src/services/aiService.ts` (主进程)

**接口**:
```typescript
class AIService {
  async generateExpansionOptions(
    request: GenerateExpansionOptionsRequest
  ): Promise<ExpansionOption[]>;
  
  async generateFinalPrompt(
    request: GenerateFinalPromptRequest
  ): Promise<FinalPrompt>;
  
  setProvider(provider: 'openai' | 'deepseek'): void;
  setApiKey(provider: string, apiKey: string): void;
}
```

**实现**:
- 使用Node.js原生http/https模块
- 支持多个AI服务提供商
- 实现重试机制
- 实现超时处理

---

### 2. StorageService

**文件**: `src/services/storageService.ts` (主进程)

**接口**:
```typescript
class StorageService {
  async savePrompt(prompt: SavedPrompt): Promise<string>; // 返回文件路径
  async loadPrompt(id: string): Promise<SavedPrompt>;
  async loadPromptList(limit?: number, offset?: number): Promise<SavedPrompt[]>;
  async deletePrompt(id: string): Promise<void>;
  getStoragePath(): string; // 返回存储目录路径
}
```

**实现**:
- 使用Node.js fs模块
- 存储在用户数据目录
- 文件格式: JSON
- 实现错误处理

---

## 工具函数接口

### 1. promptFormatter

**文件**: `src/utils/promptFormatter.ts`

**接口**:
```typescript
export function formatPromptForExport(
  prompt: FinalPrompt,
  metadata?: {
    initialRequirement: string;
    iterationCount: number;
    createdAt: string;
  },
  format: 'txt' | 'md' = 'md'
): string;

export function countWords(text: string): number;
export function countParagraphs(text: string): number;
```

**功能**:
- 格式化提示词为导出格式
- 统计字数和段落数
- 支持文本和Markdown格式

---

## 类型定义

所有类型定义在 `src/types/prompt-expander.ts` 中：

```typescript
export interface ExpansionOption { ... }
export interface ExpansionStep { ... }
export interface ExpansionHistory { ... }
export interface FinalPrompt { ... }
export interface PromptExpanderState { ... }
export interface SavedPrompt { ... }
```

---

## 组件通信流程

```
PromptExpander (主组件)
  ├─ usePromptExpander (状态管理)
  │   ├─ useAIService (AI调用)
  │   │   └─ IPC → 主进程 AIService
  │   └─ StorageService (存储)
  │       └─ IPC → 主进程 StorageService
  │
  ├─ InitialInput
  │   └─ 输入验证 → usePromptExpander.setInitialRequirement
  │
  ├─ ExpansionOptions
  │   └─ 选择 → usePromptExpander.selectExpansionOption
  │
  ├─ IterationProgress
  │   └─ 完成 → usePromptExpander.completeEarly
  │
  ├─ FinalPrompt
  │   ├─ 保存 → usePromptExpander.savePrompt
  │   └─ 导出 → usePromptExpander.exportPrompt
  │
  └─ HistoryView
      └─ 显示历史记录
```
